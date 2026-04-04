/**
 * Azure DevOps backlog reorder tests
 * Verifies rank detection, batching, and lightweight backlog retrieval.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADO_FIELDS } from "../types/adoFieldTypes.js";

const {
  createAdoConnectionMock,
  queryByWiqlMock,
  getWorkItemsMock,
  updateWorkItemMock,
  retryWithBackoffMock,
} = vi.hoisted(() => ({
  createAdoConnectionMock: vi.fn(),
  queryByWiqlMock: vi.fn(),
  getWorkItemsMock: vi.fn(),
  updateWorkItemMock: vi.fn(),
  retryWithBackoffMock: vi.fn(),
}));

vi.mock("../adoClient.js", () => ({
  createAdoConnection: createAdoConnectionMock,
}));

vi.mock("../adoWorkItems.js", () => ({
  updateWorkItem: updateWorkItemMock,
}));

vi.mock("../lib/retryWithBackoff.js", () => ({
  RETRY_PRESETS: { standard: {} },
  retryWithBackoff: retryWithBackoffMock,
}));

import {
  calculateInsertionRank,
  clearRankFieldCache,
  detectRankField,
  getBacklog,
  sortBacklogItems,
} from "../adoBacklogReorder.js";

function buildMetadataItem(id: number, rank: number) {
  return {
    id,
    fields: {
      [ADO_FIELDS.TITLE]: `Work Item ${id}`,
      [ADO_FIELDS.STATE]: id % 2 === 0 ? "Active" : "New",
      [ADO_FIELDS.WORK_ITEM_TYPE]: "User Story",
      [ADO_FIELDS.AREA_PATH]: "Area\\Path",
      [ADO_FIELDS.ASSIGNED_TO]: { displayName: `User ${id}` },
      [ADO_FIELDS.CREATED_DATE]: `2026-03-${String(id).padStart(2, "0")}T12:00:00.000Z`,
      [ADO_FIELDS.CHANGED_DATE]: `2026-03-${String(id).padStart(2, "0")}T13:00:00.000Z`,
      "System.BoardColumn": "In Development",
      "System.CommentCount": id,
      [ADO_FIELDS.STACK_RANK]: rank,
    },
  };
}

function buildRichTextItem(id: number) {
  return {
    id,
    fields: {
      [ADO_FIELDS.DESCRIPTION]: `<p>Description ${id}</p>`,
      [ADO_FIELDS.ACCEPTANCE_CRITERIA]: `<p>Acceptance ${id}</p>`,
      [ADO_FIELDS.DEVELOPMENT_SUMMARY]: `<p>Development ${id}</p>`,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearRankFieldCache();

  createAdoConnectionMock.mockResolvedValue({
    project: "Digital Platforms",
    getWorkItemTrackingApi: async () => ({
      queryByWiql: queryByWiqlMock,
      getWorkItems: getWorkItemsMock,
    }),
  });

  retryWithBackoffMock.mockImplementation(async (operation: () => Promise<unknown>) => operation());
  updateWorkItemMock.mockResolvedValue(undefined);
});

describe("detectRankField", () => {
  it("falls back to BacklogPriority and reuses cache for repeated calls", async () => {
    queryByWiqlMock.mockResolvedValue({ workItems: [{ id: 41 }] });
    getWorkItemsMock.mockResolvedValue([
      {
        id: 41,
        fields: {
          [ADO_FIELDS.BACKLOG_PRIORITY]: 900,
        },
      },
    ]);

    await expect(detectRankField("Area\\Path", "User Story")).resolves.toBe("BacklogPriority");
    await expect(detectRankField("Area\\Path", "User Story")).resolves.toBe("BacklogPriority");

    expect(queryByWiqlMock).toHaveBeenCalledTimes(1);
    expect(getWorkItemsMock).toHaveBeenCalledTimes(1);
  });
});

describe("getBacklog batching", () => {
  it("skips rich text fetches in light detail mode", async () => {
    queryByWiqlMock.mockResolvedValue({
      workItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });

    getWorkItemsMock.mockImplementation(
      async (ids: number[], fields?: string[], _asOf?: unknown, expand?: number) => {
        if (
          fields?.includes(ADO_FIELDS.STACK_RANK) &&
          fields?.includes(ADO_FIELDS.BACKLOG_PRIORITY)
        ) {
          return [{ id: 1, fields: { [ADO_FIELDS.STACK_RANK]: 100 } }];
        }

        if (fields?.includes("System.CommentCount")) {
          return ids.map((id, index) => buildMetadataItem(id, 100 + index));
        }

        if (expand === 4) {
          return ids.map((id) => ({ id, relations: [] }));
        }

        if (fields?.includes(ADO_FIELDS.DESCRIPTION)) {
          return ids.map((id) => buildRichTextItem(id));
        }

        return [];
      },
    );

    const backlog = await getBacklog({
      areaPath: "Area\\Path",
      workItemType: "User Story",
      detailLevel: "light",
      top: 3,
    });

    expect(backlog.items).toHaveLength(3);
    expect(backlog.items[0]?.description).toBe("");
    expect(backlog.items[0]?.acceptanceCriteria).toBe("");
    expect(backlog.items[0]?.developmentSummary).toBe("");

    const richTextCalls = getWorkItemsMock.mock.calls.filter((call) => {
      const fields = call[1] as string[] | undefined;
      return fields?.includes(ADO_FIELDS.DESCRIPTION);
    });

    expect(richTextCalls).toHaveLength(0);
    expect(getWorkItemsMock).toHaveBeenCalledTimes(3);
  });

  it("batches rich text fetches in summary detail mode", async () => {
    const ids = Array.from({ length: 25 }, (_, index) => index + 1);
    queryByWiqlMock.mockResolvedValue({
      workItems: ids.map((id) => ({ id })),
    });

    getWorkItemsMock.mockImplementation(
      async (batchIds: number[], fields?: string[], _asOf?: unknown, expand?: number) => {
        if (
          fields?.includes(ADO_FIELDS.STACK_RANK) &&
          fields?.includes(ADO_FIELDS.BACKLOG_PRIORITY)
        ) {
          return [{ id: 1, fields: { [ADO_FIELDS.STACK_RANK]: 100 } }];
        }

        if (fields?.includes("System.CommentCount")) {
          return batchIds.map((id, index) => buildMetadataItem(id, 100 + index));
        }

        if (fields?.includes(ADO_FIELDS.DESCRIPTION)) {
          return batchIds.map((id) => buildRichTextItem(id));
        }

        if (expand === 4) {
          return batchIds.map((id) => ({ id, relations: [] }));
        }

        return [];
      },
    );

    const backlog = await getBacklog({
      areaPath: "Area\\Path",
      workItemType: "User Story",
      detailLevel: "summary",
      top: 25,
    });

    expect(backlog.items).toHaveLength(25);
    expect(backlog.items[0]?.description).toBe("<p>Description 1</p>");

    const richTextBatchSizes = getWorkItemsMock.mock.calls
      .filter((call) => {
        const fields = call[1] as string[] | undefined;
        return fields?.includes(ADO_FIELDS.DESCRIPTION);
      })
      .map((call) => (call[0] as number[]).length);

    expect(richTextBatchSizes).toEqual([20, 5]);
  });
});

describe("rank helpers", () => {
  it("sorts ranked items ahead of missing ranks and breaks ties by id", () => {
    const sorted = sortBacklogItems([
      {
        id: 10,
        title: "c",
        description: "",
        acceptanceCriteria: "",
        developmentSummary: "",
        stackRank: null,
        state: "New",
        boardColumn: "",
        createdDate: "",
        changedDate: "",
        commentCount: 0,
        workItemType: "User Story",
        areaPath: "Area",
        parent: null,
      },
      {
        id: 3,
        title: "a",
        description: "",
        acceptanceCriteria: "",
        developmentSummary: "",
        stackRank: 100,
        state: "New",
        boardColumn: "",
        createdDate: "",
        changedDate: "",
        commentCount: 0,
        workItemType: "User Story",
        areaPath: "Area",
        parent: null,
      },
      {
        id: 2,
        title: "b",
        description: "",
        acceptanceCriteria: "",
        developmentSummary: "",
        stackRank: 100,
        state: "New",
        boardColumn: "",
        createdDate: "",
        changedDate: "",
        commentCount: 0,
        workItemType: "User Story",
        areaPath: "Area",
        parent: null,
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([2, 3, 10]);
  });

  it("computes midpoint, prepend, and append insertion ranks", () => {
    expect(calculateInsertionRank(100, 200)).toBe(150);
    expect(calculateInsertionRank(null, 200)).toBe(-800);
    expect(calculateInsertionRank(200, null)).toBe(1200);
  });
});
