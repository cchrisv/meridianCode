# Salesforce Profiles & Permissions Standard

> **Meridian:** Active — `util-pr-analysis` `#file:` for permission-set/profile PRs.

Profile-light, permission-set-heavy model. Design **capabilities** first → **personas** → **profiles** only where Salesforce forces it. Least privilege. All new features and legacy refactoring.

## Model

1. **User License** → what's possible
2. **Profile** → login shell + defaults (hours/IP, apps, record types, layouts)
3. **Capability Permission Sets** → additive object/app/feature access
4. **Personas (PSGs)** → bundles of perm sets
5. **Muting Permission Sets** → persona-specific removals
6. **Custom Permissions** → feature/behavior flags (UI, Flows, Apex)
7. **Record Access** → roles, sharing rules, teams

## Profiles

**Controls:** login hours/IP · session · password · default apps · default record types · layouts.
**Does NOT control:** CRUD/FLS · app access · feature permissions → use permission sets.
**Create only when:** new login hours/IP, default apps, default RT/layouts combo.

| Element | Label                                        | API                                    |
| ------- | -------------------------------------------- | -------------------------------------- |
| Profile | `Profile – [License] – [Domain] – [Persona]` | `Profile_[License]_[Domain]_[Persona]` |

## Permission Sets (Capabilities)

Represent capabilities, not people.

Naming conventions for permission sets, permission set groups, muting sets, and custom permissions are defined in `metadata-naming-conventions.md`.

**Rules:** group only tightly coupled objects · no kitchen sinks · add-ons are overlays on domain sets.

## Permission Set Groups (Personas)

**Create when:** distinct persona · same 3-5 perm sets for many users. **Don't:** one user one-off · differs by one feature (use add-on).
**"More powerful" pattern:** Base PSG + add-on Feature Access perm set, NOT cloned PSG.
**Muting:** remove Delete/Modify All · strip advanced system perms. Same muting in multiple PSGs → revisit underlying perm sets.

## Custom Permissions

Feature/behavior flags for UI, Dynamic Forms, Flows, Apex, validation exceptions. NOT for CRUD/FLS.

Single behavior per permission · assign via perm sets · document usage location.

## Record Types & Layouts

- RT access via permission sets (new design) · default RTs via profile · page layouts via profile + RT + app
- Use Dynamic Forms to reduce layouts · RT-specific perm sets: `Object Access – Case – Escalation RT`

## Create vs Reuse

| Component   | Create                               | Reuse                         |
| ----------- | ------------------------------------ | ----------------------------- |
| Profile     | Login/session/defaults must differ   | Always prefer + adjust PSG    |
| Perm Set    | Distinct capability, some personas   | Same capability, all personas |
| PSG         | Distinct persona, repeatable pattern | One user, minor difference    |
| Custom Perm | Distinct reusable behavior           | Same capability exists        |

## Anti-Patterns

Perm sets labeled as personas · PSGs not starting with `Access –` · perm sets touching unrelated objects · cloned PSGs differing by 1-2 perms · custom perms without `Can_` prefix · profiles for individual permission gaps.

## Checklist

**New feature:** identify objects/apps/features → classify access type → create/update perm sets → update PSGs → configure muting → custom permissions → documentation.
**New persona:** document needs → reuse perm sets → create PSG if needed → confirm profile defaults.
