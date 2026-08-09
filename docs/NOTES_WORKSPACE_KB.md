# Encrypted Notes Workspace Knowledge Base

DRISHTI-Vault Notes is a linked Markdown notes workspace inside the
localhost-only vault. It combines encrypted note storage with Markdown editing,
preview, tags, wiki links, backlinks, pinning, search, and document import.

> This workspace intentionally provides a focused set of linked-note features.
> It keeps the content inside DRISHTI-Vault's encrypted SQLite database and does
> not load third-party note plugins.

## User workflow

### Create and edit

1. Open **Notes** and select **New note**.
2. Enter a title, Markdown body, optional comma-separated tags, and a card color.
3. Switch between **Edit**, **Preview**, and **Split**.
4. Select **Save note**. The browser sends the note only to the local Go server,
   which encrypts the title, body, and tags before inserting them into SQLite.

The page keeps decrypted note content only in the current React session. It does
not use `localStorage` or `sessionStorage`.

### Link notes with wiki links

Use `[[Note title]]` in a note body. In Preview or Split mode, the link is
clickable:

- If that title exists, the linked note opens.
- If it does not exist, a new editor opens with that title prefilled.
- Notes that link to the current note appear under **Linked mentions**.

Matching is case-insensitive and uses the complete note title. Aliases are also
supported: `[[Server Recovery|recovery runbook]]` links to **Server Recovery**
but displays **recovery runbook**.

### Supported Markdown preview

- Headings (`#` through `######`)
- Paragraphs, horizontal rules, and block quotes
- Bulleted, numbered, and task-list lines
- Bold text and inline/fenced code
- `http://` and `https://` links, opened in a new tab
- `[[wiki links]]` and `[[target|alias]]`

Raw HTML is not rendered. This intentionally keeps the preview small and safe;
it is not a full CommonMark parser.

### Find and organize notes

- Search checks titles, bodies, and tags locally in the current browser session.
- The tag selector narrows the card grid to one tag.
- Pin important notes so they appear in the **Pinned** section.
- Card colors are visual organization only and are not security labels.

## Import Markdown and Word documents

Drag a file into **Import a document** or click the drop area to browse. Supported
types are:

| Type | Extensions | Import behavior |
|---|---|---|
| Markdown | `.md`, `.markdown` | Preserves UTF-8 Markdown and reads supported YAML frontmatter |
| Word Open XML | `.docx` | Converts titles/headings and readable paragraph text to Markdown |

The upload limit is 8 MB. Legacy binary `.doc` files are rejected; open one in
Word or LibreOffice, save it as `.docx`, and import that copy.

### Markdown metadata

The importer understands this frontmatter subset:

```markdown
---
title: Core Switch Runbook
tags: [network, switches]
---
# Procedure

See [[Springfield Network]].
```

Tags may also be a YAML list. If `title` is missing, the importer uses the first
level-one heading, then falls back to the filename.

### DOCX conversion limits

DOCX import reads `word/document.xml` without saving the upload to disk. Word
Title and Heading 1-6 styles become Markdown headings. Images, embedded files,
comments, tracked-change metadata, headers/footers, and complex visual layout
are not imported. Review the preview after import, especially for tables and
numbered lists.

## Security and auditing

- `POST /api/notes/import` requires an authenticated vault session.
- The request is streamed into bounded memory; multipart content is not written
  to a temporary upload directory.
- The filename is reduced to its base name before use.
- Markdown must be valid UTF-8.
- Imported title, body, and tags go through the same AES-256-GCM encryption path
  as manually created notes.
- The audit log records `note.import`, the new note ID, and only the source type
  (`markdown` or `docx`). It never records the filename or note content.
- Notes require the login session but not the credential reveal window. This is
  the established Notes security model; credential passwords retain their
  separate master-password second gate.

## Implementation map

| Area | File |
|---|---|
| Import route and parsers | `apps/api-go/internal/server/notes.go` |
| Parser tests | `apps/api-go/internal/server/notes_import_test.go` |
| Typed API client | `apps/web/src/api.ts` |
| Note types | `apps/web/src/types.ts` |
| Workspace UI and safe preview | `apps/web/src/pages/NotesPage.tsx` |
| Styling and responsive layout | `apps/web/src/theme.ts` |

## Validation

```powershell
cd apps\api-go
go test ./...

cd ..\web
npm.cmd run build
```

For the container deployment, verify `GET /api/health` returns HTTP 200 and that
Podman publishes only `127.0.0.1:7788`.

## Troubleshooting

- **Legacy .doc rejected:** save it as `.docx` first.
- **Markdown rejected:** export/save it as UTF-8.
- **Import exceeds limit:** reduce the document below 8 MB; removing embedded
  media usually helps DOCX files.
- **A wiki link creates a new note:** make the `[[target]]` exactly match the
  destination title (letter case does not matter).
- **Formatting differs from Word:** DOCX import preserves readable content, not
  page layout. Adjust the generated Markdown in Split mode.
