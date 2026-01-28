# Feature Implementation: {item_id}

## Context

**Ticket ID:** {item_id}
**Title:** {title}
**Type:** {type}
**Priority:** {priority}
**Dependencies:** {depends_on}
**Generated:** {timestamp}

## Description

{description}

## Acceptance Criteria

{acceptance_criteria}

## Files Likely to Touch

{files_touched_hint}

## Constraints

1. Follow the coding standards in CLAUDE.md
2. Ensure all tests pass before marking done
3. Update documentation if needed
4. Use meaningful commit messages prefixed with [{item_id}]

## Definition of Done

A backlog item is "Done" only when:

1. **Functionality**: Feature works end-to-end via Docker Compose
2. **Database**: Migrations applied and reversible
3. **API**: Request validation and meaningful error codes
4. **UI**: Functional route with loading states and error handling
5. **Tests**: Smoke tests updated and passing
6. **Health**: `/api/health` returns OK
7. **Worker**: No orphan tasks, idempotency preserved
8. **Docs**: README or CLAUDE.md updated if needed

## Instructions for Claude Code

Implement this feature following these steps:

1. Review the existing codebase structure
2. Implement the feature according to the description
3. Add or update tests as needed
4. Verify the acceptance criteria are met
5. Update documentation if required

When complete, run:
```bash
./foospulse mark-done
```
