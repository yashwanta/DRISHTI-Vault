package server

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"unicode/utf8"

	vcrypto "github.com/yashwanta/drishti-vault/api-go/internal/crypto"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/sessions"
)

func (s *Server) registerNotes() {
	s.mux.HandleFunc("GET /api/notes", s.authed(s.listNotes))
	s.mux.HandleFunc("POST /api/notes", s.authed(s.createNote))
	s.mux.HandleFunc("POST /api/notes/import", s.authed(s.importNote))
	s.mux.HandleFunc("PUT /api/notes/{id}", s.authed(s.updateNote))
	s.mux.HandleFunc("DELETE /api/notes/{id}", s.authed(s.deleteNote))
	s.mux.HandleFunc("POST /api/notes/{id}/pin", s.authed(s.toggleNotePin))
}

const (
	maxNoteUploadBytes = 8 << 20
	maxImportedBody    = 4 << 20
)

type importedNote struct {
	Title, Body, Kind string
	Tags              []string
}

func (s *Server) importNote(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	r.Body = http.MaxBytesReader(w, r.Body, maxNoteUploadBytes)
	reader, e := r.MultipartReader()
	if e != nil {
		problem(w, 400, "Expected a Markdown or DOCX file upload.")
		return
	}

	var filename string
	var data []byte
	for {
		part, nextErr := reader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			problem(w, 400, "Could not read the uploaded file.")
			return
		}
		if part.FormName() != "file" || part.FileName() == "" {
			part.Close()
			continue
		}
		filename = path.Base(strings.ReplaceAll(part.FileName(), "\\", "/"))
		data, e = io.ReadAll(io.LimitReader(part, maxNoteUploadBytes+1))
		part.Close()
		if e != nil || len(data) > maxNoteUploadBytes {
			problem(w, http.StatusRequestEntityTooLarge, "File exceeds the 8 MB upload limit.")
			return
		}
		break
	}
	if filename == "" || len(data) == 0 {
		problem(w, 400, "Choose a non-empty .md, .markdown, or .docx file.")
		return
	}

	imported, e := parseNoteUpload(filename, data)
	if e != nil {
		problem(w, 400, e.Error())
		return
	}
	payload := map[string]any{
		"title": imported.Title,
		"body":  imported.Body,
		"tags":  imported.Tags,
		"color": "",
	}
	title, body, tags, color, pinned, e := noteFields(ss, payload)
	if e != nil {
		problem(w, 400, "The document could not be encrypted as a note.")
		return
	}
	now := database.Now()
	res, e := s.db.Exec(`INSERT INTO notes(title_enc,body_enc,tags_enc,color,pinned,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`, title, body, tags, color, pinned, ss.UserID, now, now)
	if e != nil {
		internal(w, e)
		return
	}
	id, _ := res.LastInsertId()
	database.Audit(s.db, ss.Username, "note.import", "note", id, "type="+imported.Kind, clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id, "title": imported.Title, "source_type": imported.Kind})
}

func parseNoteUpload(filename string, data []byte) (importedNote, error) {
	ext := strings.ToLower(path.Ext(filename))
	fallback := strings.TrimSpace(strings.TrimSuffix(filename, path.Ext(filename)))
	if fallback == "" {
		fallback = "Imported note"
	}
	switch ext {
	case ".md", ".markdown":
		if !utf8.Valid(data) {
			return importedNote{}, errors.New("Markdown files must use UTF-8 encoding.")
		}
		title, body, tags := parseMarkdownMetadata(strings.TrimPrefix(string(data), "\ufeff"), fallback)
		if len(body) > maxImportedBody {
			return importedNote{}, errors.New("Imported note content exceeds 4 MB.")
		}
		return importedNote{Title: title, Body: body, Tags: tags, Kind: "markdown"}, nil
	case ".docx":
		body, err := docxToMarkdown(data)
		if err != nil {
			return importedNote{}, fmt.Errorf("Could not read this DOCX file: %s", err.Error())
		}
		title, body, tags := parseMarkdownMetadata(body, fallback)
		return importedNote{Title: title, Body: body, Tags: tags, Kind: "markdown"}, nil
	case ".doc":
		return importedNote{}, errors.New("Legacy .doc files are not supported. Save the document as .docx and try again.")
	default:
		return importedNote{}, errors.New("Unsupported file type. Upload .md, .markdown, or .docx.")
	}
}

func parseMarkdownMetadata(content, fallback string) (string, string, []string) {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")
	title := ""
	tags := []string{}
	lines := strings.Split(content, "\n")
	bodyStart := 0
	if len(lines) > 0 && strings.TrimSpace(lines[0]) == "---" {
		inTagList := false
		for i := 1; i < len(lines); i++ {
			line := strings.TrimSpace(lines[i])
			if line == "---" {
				bodyStart = i + 1
				break
			}
			if strings.HasPrefix(strings.ToLower(line), "title:") {
				title = trimYAMLValue(strings.TrimSpace(line[len("title:"):]))
				inTagList = false
				continue
			}
			if strings.HasPrefix(strings.ToLower(line), "tags:") {
				raw := strings.TrimSpace(line[len("tags:"):])
				inTagList = raw == ""
				if raw != "" {
					tags = append(tags, splitTags(raw)...)
				}
				continue
			}
			if inTagList && strings.HasPrefix(line, "-") {
				tag := trimYAMLValue(strings.TrimSpace(strings.TrimPrefix(line, "-")))
				if tag != "" {
					tags = append(tags, tag)
				}
			}
		}
	}
	body := strings.TrimSpace(strings.Join(lines[bodyStart:], "\n"))
	if title == "" {
		for _, line := range strings.Split(body, "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "# ") {
				title = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "# "))
				break
			}
		}
	}
	if title == "" {
		title = fallback
	}
	return title, body, uniqueTags(tags)
}

func markdownHeadingTitle(body, fallback string) string {
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			title := strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
			if title != "" {
				return title
			}
		}
	}
	return fallback
}

func trimYAMLValue(value string) string {
	return strings.Trim(strings.TrimSpace(value), "\"'")
}

func splitTags(value string) []string {
	value = strings.Trim(strings.TrimSpace(value), "[]")
	parts := strings.Split(value, ",")
	if len(parts) == 1 {
		parts = strings.Fields(value)
	}
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if tag := strings.TrimPrefix(trimYAMLValue(part), "#"); tag != "" {
			out = append(out, tag)
		}
	}
	return out
}

func uniqueTags(tags []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, tag := range tags {
		tag = strings.TrimSpace(strings.TrimPrefix(tag, "#"))
		key := strings.ToLower(tag)
		if tag != "" && !seen[key] {
			seen[key] = true
			out = append(out, tag)
		}
	}
	return out
}

// ── DOCX → Markdown ──────────────────────────────────────────────────────────
//
// A DOCX file is a ZIP archive. The main content lives in word/document.xml.
// We also extract text from word/header*.xml, word/footer*.xml, and
// word/footnotes.xml so documents with content only in those parts still
// import cleanly.
//
// The XML parser tracks paragraph style (heading level, list type) and builds
// a Markdown string. Bold and italic runs are preserved. Tables are converted
// to GFM pipe tables. Numbered and bulleted lists use Markdown syntax.

type docxParser struct {
	paragraphs []string

	// current paragraph state
	paraText strings.Builder
	style    string // e.g. "Heading1", "ListParagraph"
	numID    string // numbering ID for lists
	ilvl     int    // list indent level
	bold     bool
	italic   bool
	inText   bool
	runText  strings.Builder

	// table state
	inTable     bool
	tableRows   [][]string
	currentRow  []string
	currentCell strings.Builder
	headerDone  bool
}

func (p *docxParser) flushRun() {
	t := p.runText.String()
	p.runText.Reset()
	if t == "" {
		return
	}
	if p.bold && p.italic {
		p.paraText.WriteString("***" + t + "***")
	} else if p.bold {
		p.paraText.WriteString("**" + t + "**")
	} else if p.italic {
		p.paraText.WriteString("_" + t + "_")
	} else {
		p.paraText.WriteString(t)
	}
}

func (p *docxParser) flushParagraph() {
	text := strings.TrimSpace(p.paraText.String())
	p.paraText.Reset()
	p.bold = false
	p.italic = false

	if p.inTable {
		// paragraphs inside a table cell just accumulate
		if text != "" {
			if p.currentCell.Len() > 0 {
				p.currentCell.WriteString(" ")
			}
			p.currentCell.WriteString(text)
		}
		return
	}
	if text == "" {
		return
	}
	p.paragraphs = append(p.paragraphs, p.formatParagraph(text))
}

func (p *docxParser) formatParagraph(text string) string {
	norm := strings.ToLower(strings.ReplaceAll(p.style, " ", ""))

	// Headings
	if norm == "title" {
		return "# " + text
	}
	if norm == "subtitle" {
		return "## " + text
	}
	if strings.HasPrefix(norm, "heading") {
		lvlStr := strings.TrimPrefix(norm, "heading")
		if level, err := strconv.Atoi(lvlStr); err == nil && level >= 1 && level <= 6 {
			return strings.Repeat("#", level) + " " + text
		}
	}

	// Lists
	if p.numID != "" || norm == "listparagraph" || strings.Contains(norm, "list") {
		indent := strings.Repeat("  ", p.ilvl)
		return indent + "- " + text
	}

	return text
}

func (p *docxParser) flushTable() {
	if len(p.tableRows) == 0 {
		p.inTable = false
		p.tableRows = nil
		p.headerDone = false
		return
	}

	// determine column count
	cols := 0
	for _, row := range p.tableRows {
		if len(row) > cols {
			cols = len(row)
		}
	}
	if cols == 0 {
		p.inTable = false
		p.tableRows = nil
		p.headerDone = false
		return
	}

	var sb strings.Builder
	for i, row := range p.tableRows {
		// pad row to cols
		for len(row) < cols {
			row = append(row, "")
		}
		sb.WriteString("| " + strings.Join(row, " | ") + " |")
		if i == 0 {
			sb.WriteString("\n|" + strings.Repeat(" --- |", cols))
		}
		if i < len(p.tableRows)-1 {
			sb.WriteString("\n")
		}
	}
	p.paragraphs = append(p.paragraphs, sb.String())

	p.inTable = false
	p.tableRows = nil
	p.headerDone = false
}

func parseDocxXML(rc io.ReadCloser, p *docxParser) error {
	defer rc.Close()
	dec := xml.NewDecoder(io.LimitReader(rc, maxImportedBody+1))
	dec.CharsetReader = func(charset string, input io.Reader) (io.Reader, error) {
		// Accept UTF-8 and ASCII; reject others gracefully
		cs := strings.ToLower(charset)
		if cs == "utf-8" || cs == "us-ascii" || cs == "ascii" {
			return input, nil
		}
		// Fall back to reading as-is for other charsets (e.g. windows-1252)
		return input, nil
	}

	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			// Non-fatal: stop parsing this part but don't fail the whole import
			break
		}

		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			// ── Table ───────────────────────────────────────────────
			case "tbl":
				p.inTable = true
				p.tableRows = nil
				p.headerDone = false
			case "tr":
				p.currentRow = nil
			case "tc":
				p.currentCell.Reset()

			// ── Paragraph ───────────────────────────────────────────
			case "p":
				p.paraText.Reset()
				p.style = ""
				p.numID = ""
				p.ilvl = 0
				p.bold = false
				p.italic = false

			// ── Paragraph properties ─────────────────────────────────
			case "pStyle":
				for _, attr := range t.Attr {
					if attr.Name.Local == "val" {
						p.style = attr.Value
					}
				}
			case "numId":
				for _, attr := range t.Attr {
					if attr.Name.Local == "val" {
						p.numID = attr.Value
					}
				}
			case "ilvl":
				for _, attr := range t.Attr {
					if attr.Name.Local == "val" {
						p.ilvl, _ = strconv.Atoi(attr.Value)
					}
				}

			// ── Run properties ───────────────────────────────────────
			case "b":
				// <w:b/> without val, or val != "0" → bold on
				val := ""
				for _, attr := range t.Attr {
					if attr.Name.Local == "val" {
						val = attr.Value
					}
				}
				if val != "0" && val != "false" {
					p.bold = true
				}
			case "i":
				val := ""
				for _, attr := range t.Attr {
					if attr.Name.Local == "val" {
						val = attr.Value
					}
				}
				if val != "0" && val != "false" {
					p.italic = true
				}
			case "bCs":
				p.bold = true
			case "iCs":
				p.italic = true

			// ── Text content ─────────────────────────────────────────
			case "t":
				p.inText = true
			case "tab":
				p.paraText.WriteByte('\t')
			case "br":
				// soft line break inside paragraph
				p.flushRun()
				p.paraText.WriteByte('\n')
			case "cr":
				p.flushRun()
				p.paraText.WriteByte('\n')
			}

		case xml.CharData:
			if p.inText {
				p.runText.Write([]byte(t))
			}

		case xml.EndElement:
			switch t.Name.Local {
			case "t":
				p.inText = false
				p.flushRun()

			case "r":
				// run ends — reset run-level formatting
				p.bold = false
				p.italic = false

			case "p":
				p.flushParagraph()

			case "tc":
				// table cell ends
				cellText := strings.TrimSpace(p.currentCell.String())
				p.currentRow = append(p.currentRow, cellText)
				p.currentCell.Reset()

			case "tr":
				if len(p.currentRow) > 0 {
					p.tableRows = append(p.tableRows, p.currentRow)
				}
				p.currentRow = nil

			case "tbl":
				p.flushTable()
			}
		}
	}
	return nil
}

func docxToMarkdown(data []byte) (string, error) {
	reader, e := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if e != nil {
		return "", errors.New("not a valid DOCX/ZIP file")
	}

	// Parts to extract, in priority order
	wantedParts := []string{
		"word/document.xml",
		"word/footnotes.xml",
		"word/endnotes.xml",
	}
	// Also collect header/footer files dynamically
	for _, f := range reader.File {
		name := f.Name
		if (strings.HasPrefix(name, "word/header") || strings.HasPrefix(name, "word/footer")) &&
			strings.HasSuffix(name, ".xml") {
			wantedParts = append(wantedParts, name)
		}
	}

	p := &docxParser{}
	found := false

	for _, wantName := range wantedParts {
		for _, zf := range reader.File {
			if zf.Name != wantName {
				continue
			}
			rc, err := zf.Open()
			if err != nil {
				continue
			}
			found = true
			_ = parseDocxXML(rc, p) // errors are non-fatal; we keep whatever we got
			break
		}
	}

	if !found {
		return "", errors.New("word/document.xml not found — is this a valid .docx file?")
	}

	body := strings.TrimSpace(strings.Join(p.paragraphs, "\n\n"))

	// Trim excessive blank lines
	for strings.Contains(body, "\n\n\n") {
		body = strings.ReplaceAll(body, "\n\n\n", "\n\n")
	}

	if body == "" {
		return "", errors.New("document has no readable text (may contain only images or shapes)")
	}
	if len(body) > maxImportedBody {
		body = body[:maxImportedBody]
	}
	return body, nil
}

func (s *Server) noteOwned(ss *sessions.Session, id int64) (int64, bool) {
	var owner int64
	e := s.db.QueryRow("SELECT owner_id FROM notes WHERE id=?", id).Scan(&owner)
	return owner, e == nil && (owner == ss.UserID || ss.Role == "super_admin")
}
func (s *Server) listNotes(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	q := "SELECT id,title_enc,body_enc,tags_enc,color,pinned,owner_id,created_at,updated_at FROM notes"
	args := []any{}
	if ss.Role != "super_admin" {
		q += " WHERE owner_id=?"
		args = append(args, ss.UserID)
	}
	q += " ORDER BY pinned DESC,updated_at DESC"
	rows, e := s.db.Query(q, args...)
	if e != nil {
		internal(w, e)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, owner int64
		var title, body, tags, color string
		var pinned int
		var created, updated string
		if e = rows.Scan(&id, &title, &body, &tags, &color, &pinned, &owner, &created, &updated); e != nil {
			internal(w, e)
			return
		}
		title, e = vcrypto.DecryptField(ss.DEK, title)
		if e != nil {
			internal(w, e)
			return
		}
		body, e = vcrypto.DecryptField(ss.DEK, body)
		if e != nil {
			internal(w, e)
			return
		}
		tags, e = vcrypto.DecryptField(ss.DEK, tags)
		if e != nil {
			internal(w, e)
			return
		}
		tv := []string{}
		if tags != "" {
			_ = json.Unmarshal([]byte(tags), &tv)
		}
		if tv == nil {
			tv = []string{}
		}
		items = append(items, map[string]any{"id": id, "title": title, "body": body, "tags": tv, "color": color, "pinned": pinned != 0, "owner_id": owner, "created_at": created, "updated_at": updated})
	}
	jsonOut(w, 200, map[string]any{"items": items})
}
func validColor(v string) bool {
	switch v {
	case "", "yellow", "green", "blue", "pink", "purple", "gray":
		return true
	}
	return false
}
func noteFields(ss *sessions.Session, b map[string]any) (string, string, string, string, bool, error) {
	color := str(b["color"])
	if !validColor(color) {
		return "", "", "", "", false, sql.ErrNoRows
	}
	title, e := vcrypto.EncryptField(ss.DEK, str(b["title"]))
	if e != nil {
		return "", "", "", "", false, e
	}
	body, e := vcrypto.EncryptField(ss.DEK, str(b["body"]))
	if e != nil {
		return "", "", "", "", false, e
	}
	tagValue := b["tags"]
	if tagValue == nil {
		tagValue = []string{}
	}
	raw, _ := json.Marshal(tagValue)
	tags, e := vcrypto.EncryptField(ss.DEK, string(raw))
	return title, body, tags, color, b["pinned"] == true, e
}
func (s *Server) createNote(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	title, body, tags, color, pinned, e := noteFields(ss, b)
	if e != nil {
		problem(w, 400, "Invalid note.")
		return
	}
	now := database.Now()
	res, e := s.db.Exec(`INSERT INTO notes(title_enc,body_enc,tags_enc,color,pinned,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`, title, body, tags, color, pinned, ss.UserID, now, now)
	if e != nil {
		internal(w, e)
		return
	}
	id, _ := res.LastInsertId()
	database.Audit(s.db, ss.Username, "note.create", "note", id, "color="+color, clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id})
}
func (s *Server) updateNote(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	if _, ok := s.noteOwned(ss, id); !ok {
		problem(w, 404, "Note not found.")
		return
	}
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	sets := []string{}
	args := []any{}
	for _, p := range []struct {
		json, col string
		encrypted bool
	}{{"title", "title_enc", true}, {"body", "body_enc", true}, {"tags", "tags_enc", true}, {"color", "color", false}, {"pinned", "pinned", false}} {
		v, exists := b[p.json]
		if !exists {
			continue
		}
		if p.json == "color" && !validColor(str(v)) {
			problem(w, 400, "Invalid color.")
			return
		}
		if p.encrypted {
			raw := str(v)
			if p.json == "tags" {
				x, _ := json.Marshal(v)
				raw = string(x)
			}
			x, e := vcrypto.EncryptField(ss.DEK, raw)
			if e != nil {
				internal(w, e)
				return
			}
			v = x
		}
		sets = append(sets, p.col+"=?")
		args = append(args, v)
	}
	if len(sets) == 0 {
		jsonOut(w, 200, map[string]any{"ok": true, "updated": false})
		return
	}
	sets = append(sets, "updated_at=?")
	args = append(args, database.Now(), id)
	_, e := s.db.Exec("UPDATE notes SET "+strings.Join(sets, ",")+" WHERE id=?", args...)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "note.edit", "note", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true, "updated": true})
}
func (s *Server) deleteNote(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	if _, ok := s.noteOwned(ss, id); !ok {
		problem(w, 404, "Note not found.")
		return
	}
	_, e := s.db.Exec("DELETE FROM notes WHERE id=?", id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "note.delete", "note", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) toggleNotePin(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	if _, ok := s.noteOwned(ss, id); !ok {
		problem(w, 404, "Note not found.")
		return
	}
	var old int
	_ = s.db.QueryRow("SELECT pinned FROM notes WHERE id=?", id).Scan(&old)
	v := 1
	if old != 0 {
		v = 0
	}
	_, e := s.db.Exec("UPDATE notes SET pinned=?,updated_at=? WHERE id=?", v, database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "note.pin", "note", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id, "pinned": v != 0})
}
