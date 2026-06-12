# Client-Server Model

## Decision
ATEROMANTE should support two delivery roles:

- Player Client
- Moderator Server

The same codebase may produce both roles through configuration, build mode, deployment profile or packaging options.

## Why
Human training matches require explicit control over allowed assistance.

A moderator station can create a room, invite players and control:

- tutor enabled or disabled;
- engine enabled or disabled;
- private tutor;
- symmetric hints;
- shared class mode;
- post-game-only analysis;
- pause and study branch permissions;
- export markings for assisted training games.

## Roles

### Player Client
The player client:
- joins a room;
- receives match policy from the moderator server;
- submits legal moves;
- stores local learning data;
- runs local tutor only within the allowed policy;
- keeps private material and private tutor notes local.

### Moderator Server
The moderator server:
- creates rooms;
- approves participants;
- sets match policy;
- starts, pauses and ends sessions;
- validates event order;
- broadcasts accepted moves;
- records session-level audit events;
- can switch between class mode, private tutoring, symmetric hints or post-game review.

## Packaging Options

### Option A - Same App, Role Config
One app package. The user selects or configures a role:

- `player`
- `moderator`
- `hybrid`

Best for early development.

### Option B - Same Codebase, Separate Builds
One repository, two builds:

- `ateromante-client`
- `ateromante-moderator`

Best when distribution becomes public and simpler UX matters.

### Option C - Dedicated Server Package
Separate server process plus desktop/web clients.

Best when sessions need remote hosting, persistence, accounts or multiple rooms.

## Recommended Path
Start with Option A.

The first spike should keep the role in configuration and UI state. The networking layer can be added later without changing the chessboard or tutor components.

## Policy Contract

```ts
type TutorVisibility = "none" | "private" | "shared" | "symmetric";
type AssistanceTiming = "live" | "post_game" | "paused_only";
type EnginePermission = "disabled" | "evaluation_only" | "best_moves";

interface MatchPolicy {
  tutorVisibility: TutorVisibility;
  assistanceTiming: AssistanceTiming;
  enginePermission: EnginePermission;
  allowStudyBranches: boolean;
  markExportsAsAssisted: boolean;
}
```

## Network Recommendation
Use an authoritative WebSocket or Socket.IO server first.

Reason:
- easier moderation;
- easier reconnection;
- easier audit logs;
- easier classroom/coaching mode;
- simpler than WebRTC for the first networked version.

WebRTC DataChannels remain a future option for peer-to-peer sessions, but they require signaling, STUN/TURN and privacy warnings.

## Safety
Any human-vs-human assisted session must visibly show:

- training mode;
- tutor policy;
- engine policy;
- whether help is private, symmetric or shared;
- whether the game export is marked as assisted.

No assisted session should be represented as competitive rating play.
