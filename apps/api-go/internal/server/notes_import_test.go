package server

import (
	"archive/zip"
	"bytes"
	"testing"
)

func TestParseMarkdownUpload(t *testing.T) {
	content := "---\r\ntitle: 'Imported Runbook'\r\ntags: [network, #switches]\r\n---\r\n# Body heading\r\n\r\nConnect to [[Core Switch]]."
	note, err := parseNoteUpload("fallback.md", []byte(content))
	if err != nil {
		t.Fatalf("parseNoteUpload: %v", err)
	}
	if note.Title != "Imported Runbook" {
		t.Fatalf("title = %q", note.Title)
	}
	if note.Kind != "markdown" || note.Body != "# Body heading\n\nConnect to [[Core Switch]]." {
		t.Fatalf("unexpected imported note: %#v", note)
	}
	if len(note.Tags) != 2 || note.Tags[0] != "network" || note.Tags[1] != "switches" {
		t.Fatalf("tags = %#v", note.Tags)
	}
}

func TestParseDOCXUpload(t *testing.T) {
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	document, err := writer.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	xml := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Recovery Guide</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Procedure</w:t></w:r></w:p>
<w:p><w:r><w:t>Restart the service.</w:t></w:r></w:p>
</w:body></w:document>`
	if _, err = document.Write([]byte(xml)); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}

	note, err := parseNoteUpload("recovery.docx", buffer.Bytes())
	if err != nil {
		t.Fatalf("parseNoteUpload: %v", err)
	}
	if note.Title != "recovery" || note.Kind != "docx" {
		t.Fatalf("unexpected metadata: %#v", note)
	}
	want := "# Recovery Guide\n\n## Procedure\n\nRestart the service."
	if note.Body != want {
		t.Fatalf("body = %q; want %q", note.Body, want)
	}
}

func TestRejectsLegacyDOC(t *testing.T) {
	if _, err := parseNoteUpload("legacy.doc", []byte("not a DOCX")); err == nil {
		t.Fatal("expected legacy .doc rejection")
	}
}
