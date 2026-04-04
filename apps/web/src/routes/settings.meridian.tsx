import { createFileRoute } from "@tanstack/react-router";

import { MeridianExplorerPage } from "../components/settings/MeridianExplorer";

export const Route = createFileRoute("/settings/meridian")({
  component: MeridianExplorerPage,
});
