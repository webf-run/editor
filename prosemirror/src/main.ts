import "./style.css";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { Schema } from "prosemirror-model";

const schema = new Schema({
  nodes: {
    text: {},
    doc: { content: "paragraph*" },
    paragraph: {
      content: "text*",
      group: "block",
      toDOM() {
        return ["p", 0];
      },
      parseDOM: [{ tag: "p" }],
    },
  },

  marks: {
    bold: {
      toDOM() {
        return ["strong", 0];
      },
      parseDOM: [{ tag: "strong" }],
    },
    italic: {
      toDOM() {
        return ["em", 0];
      },
      parseDOM: [{ tag: "em" }],
    },
    underline: {
      toDOM() {
        return ["u", 0];
      },
      parseDOM: [{ tag: "u" }, { style: "text-decoration-line=underline" }],
    },
    strikethrough: {
      toDOM() {
        return ["s", 0];
      },
      parseDOM: [{ tag: "s" }, { style: "text-decoration: line-through" }],
    },
  },
});

function createKeymapPlugin(): Plugin {
  return keymap({
    "Mod-b": toggleMark(schema.marks.bold),
    "Mod-i": toggleMark(schema.marks.italic),
    "Mod-u": toggleMark(schema.marks.underline),
    "Ctrl-Shift-S": toggleMark(schema.marks.strikethrough),
    "Alt-Shift-S": toggleMark(schema.marks.strikethrough),
    "Mod-z": undo,
    "Mod-y": redo,
  });
}

const state = EditorState.create({
  schema,
  plugins: [history(), keymap(baseKeymap), createKeymapPlugin()],
});

const editorContainer = document.querySelector("#editor") as HTMLElement;
if (editorContainer) {
  let view = new EditorView(editorContainer, {
    state,
    dispatchTransaction(transaction) {
      console.log(transaction.doc.content.toString());

      let newState = view.state.apply(transaction);
      view.updateState(newState);
    },
  });
}
