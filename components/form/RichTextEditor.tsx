'use client';

import { useEffect, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
  UnlinkIcon,
} from 'lucide-react';
import { buildMediaUrl, type MediaUrlContext } from '@buildkart/contract';
import { MediaPickerDialog, type PickedImage } from '@/components/media/ProductImages';
import { cn } from '@/lib/utils';

/**
 * The rich-text editor behind pages and blog posts.
 *
 * Its output is **not** trusted. Whatever this produces is sanitised server-side
 * by `sanitizeHtml` before it is stored, and the toolbar below is deliberately
 * limited to the tags that survive that allowlist — an editor offering
 * formatting the sanitiser would strip is an editor that silently loses work.
 *
 * Uncontrolled after mount, on purpose: feeding `value` back in on every render
 * would reset the cursor to the start of the document on every keystroke. The
 * effect below re-syncs only when the incoming value genuinely differs from
 * what the editor already holds, which happens on a form reset, not on typing.
 */
export function RichTextEditor({
  value,
  onChange,
  ctx,
  placeholder,
  lang,
}: {
  value: string;
  onChange: (html: string) => void;
  ctx: MediaUrlContext;
  placeholder?: string;
  lang?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const editor = useEditor({
    // Next renders this on the server first; without the flag React warns about
    // the DOM the editor builds during hydration.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Nothing here that `sanitizeHtml` would strip: a code block or a task
        // list would look like it saved and come back as plain text.
        codeBlock: false,
        code: false,
        horizontalRule: {},
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } }),
      Image.configure({ inline: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose-editor min-h-[220px] px-3 py-2.5 focus:outline-none',
        ...(lang ? { lang } : {}),
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    // Only when the two have actually diverged — see the note above.
    if (value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) {
    // A matching-height placeholder, so the form does not jump on mount.
    return <div className="bg-card min-h-[264px] rounded-md border" />;
  }

  return (
    <div className="bg-card overflow-hidden rounded-md border">
      <Toolbar editor={editor} onPickImage={() => setPickerOpen(true)} />

      <EditorContent editor={editor} />

      {placeholder && editor.isEmpty && (
        <p className="text-muted-foreground pointer-events-none -mt-[220px] px-3 py-2.5 text-sm">
          {placeholder}
        </p>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        ctx={ctx}
        alreadyPicked={[]}
        onConfirm={(picked: PickedImage[]) => {
          for (const image of picked) {
            // No public base URL means R2 is not serving yet; inserting a
            // half-formed src would bake a broken image into the saved article.
            if (!ctx.publicBaseUrl) continue;
            editor
              .chain()
              .focus()
              .setImage({
                // A generous width: this image is going into an article body,
                // not a thumbnail grid.
                src: buildMediaUrl(ctx.publicBaseUrl, ctx.transformsEnabled, image.r2Key, {
                  w: 1200,
                }),
                alt: image.altTextEn ?? '',
              })
              .run();
          }
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
      <Button
        icon={BoldIcon}
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <Button
        icon={ItalicIcon}
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />

      <Divider />

      <Button
        icon={Heading2Icon}
        label="Heading"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <Button
        icon={Heading3Icon}
        label="Subheading"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Divider />

      <Button
        icon={ListIcon}
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <Button
        icon={ListOrderedIcon}
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <Button
        icon={QuoteIcon}
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      <Divider />

      <Button
        icon={LinkIcon}
        label="Add a link"
        active={editor.isActive('link')}
        onClick={() => {
          const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
          const href = window.prompt('Link to', previous);
          if (href === null) return;
          if (href.trim() === '') {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
        }}
      />
      {editor.isActive('link') && (
        <Button
          icon={UnlinkIcon}
          label="Remove the link"
          onClick={() => editor.chain().focus().unsetLink().run()}
        />
      )}
      <Button icon={ImageIcon} label="Insert an image" onClick={onPickImage} />

      <Divider />

      <Button
        icon={Undo2Icon}
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <Button
        icon={Redo2Icon}
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

function Divider() {
  return <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />;
}

function Button({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof BoldIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'hover:bg-background rounded p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-background text-foreground shadow-sm',
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
