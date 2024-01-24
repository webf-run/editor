import "./style.css";
import { EditorState, Plugin, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { NodeType, Schema } from "prosemirror-model";

const schema = new Schema({
  nodes: {
    text: {},
    doc: { content: "(paragraph|unordered_list|ordered_list)*" },
    paragraph: {
      content: "text*",
      group: "block",
      toDOM() {
        return ["p", 0];
      },
      parseDOM: [{ tag: "p" }],
    },
    nested_list: {
      content: "(paragraph|unordered_list|ordered_list|list_item)*",
      group: "block",
      toDOM() {
        return ["div", { class: "nested-list" }, 0];
      },
      parseDOM: [{ tag: "div.nested-list" }],
    },
    list_item: {
      content: "(paragraph|nested_list)*",
      defining: true,
      draggable: false,
      toDOM() {
        return ["li", { class: "bullet-item" }, 0];
      },
      parseDOM: [{ tag: "li" }],
    },
    unordered_list: {
      content: "list_item*",
      group: "block",
      toDOM() {
        return ["ul", { class: "bullet-list" }, 0];
      },
      parseDOM: [{ tag: "ul" }],
    },
    ordered_list: {
      content: "list_item*",
      group: "block",
      attrs: { order: { default: 1 } },
      toDOM(node) {
        return node.attrs.order == 1
          ? ["ol", { class: "ordered-list", start: 1 }, 0]
          : ["ol", { class: "ordered-list", start: node.attrs.order }];
      },
      parseDOM: [{ tag: "ol" }],
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

//Command to toggle list

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
let view = new EditorView(editorContainer, {
  state,
  dispatchTransaction(transaction) {
    console.log(transaction.doc.content.toString());

    let newState = view.state.apply(transaction);
    view.updateState(newState);
  },
});

function isListItemAtPos($pos: any): boolean {
  const node = $pos.node($pos.depth - 1);
  const nestedNode = $pos.node($pos.depth - 2);
  return (
    (node && node.type.name === "list_item") ||
    (nestedNode && nestedNode.type.name === "list_item")
  );
}

// Handle Enter key press event
editorContainer.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    const { $from, $to } = view.state.selection;
    const isInsideListItem = isListItemAtPos($from);

    if (isInsideListItem) {
      event.preventDefault();
      const listContent = schema.nodes.paragraph.create();
      const listItem = schema.nodes.list_item.create(null, listContent);

      const tr = view.state.tr.replaceWith($to.before(), $to.after(), listItem);

      view.dispatch(tr);
      view.focus();
    }
  }
});

editorContainer.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Tab") {
    const { $from, $to } = view.state.selection;
    const range = $from.blockRange($to);
    const isInsideListItem = isListItemAtPos($from);
    const isFirstListItem = $from.node(-2);
    if (
      isFirstListItem.child(0) !== $from.node($from.depth - 1) &&
      isInsideListItem
    ) {
      event.preventDefault();
      const currentListItem = $from.node($from.depth - 1);
      const previousListItemContent = isFirstListItem.child(
        isFirstListItem.childCount - 2
      );
      const newParentContent = schema.nodes.paragraph.create(
        null,
        schema.text(previousListItemContent.textContent)
      );
      const newTypeList =
        $from.node($from.depth - 2).type.name === "unordered_list"
          ? schema.nodes.unordered_list.create(null, currentListItem)
          : schema.nodes.ordered_list.create(null, currentListItem);

      const newParentDiv = schema.nodes.nested_list.create(null, [
        newParentContent,
        newTypeList,
      ]);
      const newListItem = schema.nodes.list_item.create(null, newParentDiv);
      console.log($from.start(-2), $from.start(-1), $from);

      if (range) {
        const tr = view.state.tr.replaceRangeWith(
          $from.start(-2),
          $from.before(),
          newListItem
        );

        view.dispatch(tr);
      }
    }
    view.focus();
  }
});

function selectedNodeType(node: NodeType): string {
  if (node.name === "paragraph") return "paragraph";
  else if (node.name === "unordered_list") return "unordered_list";
  else if (node.name === "ordered_list") return "ordered_list";
  else if (node.name === "list_item") return "list_item";
  return "";
}

function converToList(listType: string, tr: Transaction) {
  const { $from, $to } = tr.selection;
  let range = $from.blockRange($to);
  if (range) {
    let newNodeToBeCreated;
    let fromPos, toPos;
    if (
      range.$from.node($from.depth - 1).type.name === "list_item" &&
      range.$from.node($from.depth - 2).type.name === listType
    ) {
      const nodeContent = range?.$from.node($from.depth).textContent;
      newNodeToBeCreated = nodeContent
        ? schema.nodes.paragraph.create({}, [schema.text(nodeContent)])
        : schema.nodes.paragraph.create();
      fromPos = $from.pos - $from.node($from.depth).nodeSize - 1;
      toPos = $from.pos;
    } else {
      const nodeContent = range?.$from.node($from.depth).textContent;
      const listPara = nodeContent
        ? schema.nodes.paragraph.create(null, [schema.text(nodeContent)])
        : schema.nodes.paragraph.create();
      const listItem = schema.nodes.list_item.create(null, [listPara]);
      newNodeToBeCreated =
        listType === "unordered_list"
          ? schema.nodes.unordered_list.create(null, [listItem])
          : schema.nodes.ordered_list.create(null, [listItem]);
      if (range.$from.node($from.depth - 1).type.name !== "list_item") {
        fromPos = $from.pos - range.$from.node($from.depth).nodeSize + 1;
      } else {
        fromPos = $from.pos - $from.node($from.depth).nodeSize - 1;
      }
      toPos = $from.pos;
    }

    return tr.replaceWith(fromPos, toPos, newNodeToBeCreated);
  }
}

function insertList(listType: string): Transaction {
  const listContent = schema.nodes.paragraph.create();
  const listItem = schema.nodes.list_item.create(null, listContent);
  const list =
    listType === "unordered"
      ? schema.nodes.unordered_list.create(null, [listItem])
      : schema.nodes.ordered_list.create(null, [listItem]);
  const tr = view.state.tr.replaceWith(
    view.state.selection.$from.pos,
    view.state.selection.$to.pos,
    list
  );
  return tr;
}

const unorderedListButton = document.querySelector(".unordered-list-button");
const orderedListButton = document.querySelector(".ordered-list-button");
if (unorderedListButton) {
  unorderedListButton.addEventListener("click", () => {
    const { $from, $to } = view.state.selection;
    const range = $from.blockRange($to);

    if (!range) {
      const transaction = insertList("unordered");
      if (transaction) view.dispatch(transaction);
    } else {
      let currentNodeType;
      if (range?.$from.node($from.depth - 1).type.name === "list_item")
        currentNodeType = range?.$from.node($from.depth - 2).type.name;
      else currentNodeType = selectedNodeType(range?.$from.node().type);

      if (
        currentNodeType === "paragraph" ||
        currentNodeType === "unordered_list" ||
        currentNodeType === "ordered_list"
      ) {
        const transaction = converToList("unordered_list", view.state.tr);
        if (transaction) view.dispatch(transaction);
      }
    }
    view.focus();
  });
}

if (orderedListButton) {
  orderedListButton.addEventListener("click", () => {
    const { $from, $to } = view.state.selection;
    const range = $from.blockRange($to);

    if (!range) {
      const transaction = insertList("ordered");
      if (transaction) view.dispatch(transaction);
      view.focus();
    } else {
      let currentNodeType;
      if (range?.$from.node($from.depth - 1).type.name === "list_item")
        currentNodeType = range?.$from.node($from.depth - 2).type.name;
      else currentNodeType = selectedNodeType(range?.$from.node().type);

      if (
        currentNodeType === "paragraph" ||
        currentNodeType === "unordered_list" ||
        currentNodeType === "ordered_list"
      ) {
        const transaction = converToList("ordered_list", view.state.tr);
        if (transaction) view.dispatch(transaction);
      }
    }
    view.focus();
  });
}
