"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { Bold, Italic, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";

interface SoapNoteEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function SoapNoteEditor({
  value,
  onChange,
  placeholder,
  className,
}: SoapNoteEditorProps) {
  const t = useTranslations();
  const [isEmpty, setIsEmpty] = useState(!value);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { HTMLAttributes: { class: "list-disc list-inside" } },
        orderedList: { HTMLAttributes: { class: "list-decimal list-inside" } },
        paragraph: { HTMLAttributes: { class: "mb-2" } },
        code: { HTMLAttributes: { class: "bg-muted px-1 rounded text-xs font-mono" } },
        codeBlock: { HTMLAttributes: { class: "bg-muted p-2 rounded text-xs font-mono overflow-x-auto mb-2" } },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none p-3 min-h-32",
          "text-foreground placeholder-muted-foreground",
          className
        ),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = value || "";
    const currentValue = editor.isEmpty ? "" : editor.getHTML();
    if (currentValue === nextValue) return;
    editor.commands.setContent(nextValue, false);
    setIsEmpty(editor.isEmpty);
  }, [editor, value]);

  if (!editor) return null;

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run();
  const clearFormatting = () => editor.chain().focus().clearNodes().run();

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50 flex-wrap">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("bold") ? "default" : "outline"}
            onClick={toggleBold}
            title={`${t("clinicalRecords.editor.bold")} (Ctrl+B)`}
            className="h-8 w-8 p-0"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("italic") ? "default" : "outline"}
            onClick={toggleItalic}
            title={`${t("clinicalRecords.editor.italic")} (Ctrl+I)`}
            className="h-8 w-8 p-0"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("underline") ? "default" : "outline"}
            onClick={toggleUnderline}
            title={`${t("clinicalRecords.editor.underline")} (Ctrl+U)`}
            className="h-8 w-8 p-0"
          >
            <u className="text-sm font-bold">U</u>
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title={t("clinicalRecords.editor.bullets")}
            className="h-8 px-2 text-xs"
          >
            {t("clinicalRecords.editor.bulletListButton")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title={t("clinicalRecords.editor.orderedList")}
            className="h-8 px-2 text-xs"
          >
            {t("clinicalRecords.editor.orderedListButton")}
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={clearFormatting}
          title={t("clinicalRecords.editor.clearFormatting")}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div className="relative">
        <EditorContent editor={editor} />
        {isEmpty && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
            {placeholder ?? t("clinicalRecords.editor.placeholder")}
          </div>
        )}
      </div>
    </div>
  );
}
