// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const decorationTypeProvider = () => vscode.window.createTextEditorDecorationType({
});
let decorationType = decorationTypeProvider();
const decorations = new Map<string, Map<number, vscode.DecorationOptions>>();
const addedSpaces = new Map<string, Map<number, {pos: vscode.Position; count: number}>>();
const lastSelections = new Map<string, readonly vscode.Selection[]>();

let enabled = true;
let disposables: vscode.Disposable[] = [];

function setupEventHandlers(context: vscode.ExtensionContext) {
  let disposable = vscode.workspace.onDidChangeTextDocument(change => {
    //console.log(change);
    if (change.document !== vscode.window.activeTextEditor?.document) {
      //console.log("inactive");
      return;
    }
    const editor = vscode.window.activeTextEditor;
    checkFullEditorDocument(editor);
    return;
    // change.contentChanges.forEach(c => {
    //   if (c.range.isSingleLine) {
    //     alignBlockForLine(editor, c.range);
    //   }
    // });

  });
  context.subscriptions.push(disposable);
  disposables.push(disposable);

  disposable = vscode.workspace.onDidOpenTextDocument(evt => {
    const editor = vscode.window.visibleTextEditors.find(editor => editor.document === evt);
    if (editor === undefined) {
      return;
    }
    checkFullEditorDocument(editor);
  });
  context.subscriptions.push(disposable);
  disposables.push(disposable);

  disposable = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor === undefined) {
      return;
    }
    lastSelections.set(editor.document.fileName, editor.selections);
    checkFullEditorDocument(editor);
  });
  context.subscriptions.push(disposable);
  disposables.push(disposable);

  disposable = vscode.workspace.onDidCloseTextDocument(document => {
    // cleanup document specific variables to save memory
    decorations.delete(document.fileName);
    addedSpaces.delete(document.fileName);
    lastSelections.delete(document.fileName);
  });
  context.subscriptions.push(disposable);
  disposables.push(disposable);

  disposable = vscode.window.onDidChangeTextEditorSelection(evt => {
    // track current selection for key handling
    lastSelections.set(evt.textEditor.document.fileName, evt.selections);
  });
  context.subscriptions.push(disposable);
  disposables.push(disposable);
}

function disposeEventHandlers() {
  disposables.forEach(disposable => disposable.dispose());
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  //console.log('Congratulations, your extension "virtual-better-align" is now active!');

  setupEventHandlers(context);

  // setup up/down/shift+up/shift+down key handling
  let disposable = vscode.commands.registerCommand('virtual-better-align.CursorUp', () => {
    if (!enabled) {
      vscode.commands.executeCommand(`cursorUp`);
    }
    if (!vscode.window.activeTextEditor) {
      return;
    }
    handleSelectionChange(vscode.window.activeTextEditor, 'up', false);
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('virtual-better-align.CursorDown', () => {
    if (!enabled) {
      vscode.commands.executeCommand(`cursorDown`);
    }
    if (!vscode.window.activeTextEditor) {
      return;
    }
    handleSelectionChange(vscode.window.activeTextEditor, 'down', false);
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('virtual-better-align.CursorShiftUp', () => {
    if (!enabled) {
      vscode.commands.executeCommand(`cursorSelectUp`);
    }
    if (!vscode.window.activeTextEditor) {
      return;
    }
    handleSelectionChange(vscode.window.activeTextEditor, 'up', true);
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('virtual-better-align.CursorShiftDown', () => {
    if (!enabled) {
      vscode.commands.executeCommand(`cursorSelectDown`);
    }
    if (!vscode.window.activeTextEditor) {
      return;
    }
    handleSelectionChange(vscode.window.activeTextEditor, 'down', true);
  });
  context.subscriptions.push(disposable);

  disposable = vscode.commands.registerCommand('virtual-better-align.ToggleActive', () => {
    if (enabled) {
      // disable
      enabled = false;
      decorationType.dispose();
      decorations.clear();
      addedSpaces.clear();
      lastSelections.clear();
      disposeEventHandlers();
    } else {
      enabled = true;
      decorationType = decorationTypeProvider();
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        lastSelections.set(editor.document.fileName, editor.selections);
        checkFullEditorDocument(editor);
      }
      setupEventHandlers(context);
    }
  });
  context.subscriptions.push(disposable);

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    lastSelections.set(editor.document.fileName, editor.selections);
    checkFullEditorDocument(editor);
  }
}

function handleSelectionChange(textEditor: vscode.TextEditor, dir: 'up' | 'down', keepAnchor: boolean) {
  if (keepAnchor && vscode.workspace.getConfiguration().get('editor.columnSelection')) {
    // cannot override the internal viewModel.cursorColumnSelectData state, so either we reimplement
    // the whole column select mode feature or don't bother.
    // Don't bother, forward to original command
    vscode.commands.executeCommand(`cursorColumnSelect${dir === 'up' ? 'Up' : 'Down'}`);
    return;
  }
  let previousSelections = lastSelections.get(textEditor.document.fileName)!;
  if (previousSelections === undefined) {
    return;
  }
  let previousSelection = previousSelections[0];
  let previousLine = previousSelection.active.line;
  const currentLine = previousLine + (dir === 'up' ? -1 : 1);

  // Calculate where the new selection should be
  let previousLineSpace = addedSpaces.get(textEditor.document.fileName)?.get(previousLine);
  let currentLineSpace = addedSpaces.get(textEditor.document.fileName)?.get(currentLine);
  let newChar = convertCoordinates(previousSelection.active, previousLineSpace, currentLineSpace);

  // replace primary selection
  const newActive = textEditor.selection.active.with(currentLine, newChar);
  let newSelection: vscode.Selection;
  if (keepAnchor) {
    newSelection = new vscode.Selection(textEditor.selection.anchor, newActive);
  } else {
    newSelection = new vscode.Selection(newActive, newActive);
  }
  textEditor.selections = [newSelection, ...textEditor.selections.slice(1)];
}

function convertCoordinates(reference: vscode.Position, referenceLineSpace: { pos: vscode.Position; count: number; } | undefined, currentLineSpace: { pos: vscode.Position; count: number; } | undefined) {
  let referenceLineSpaceCount = 0;
  let currentLineSpaceCount = 0;
  let previousChar = reference.character;
  if (currentLineSpace) {
    currentLineSpaceCount = currentLineSpace.count;
  }
  if (referenceLineSpace && referenceLineSpace.pos.character <= previousChar) {
    referenceLineSpaceCount = referenceLineSpace.count;
  } else {
    // left of colon - so no adjustment necessary
    currentLineSpaceCount = 0;
  }

  let newChar = previousChar - (currentLineSpaceCount - referenceLineSpaceCount);
  if (referenceLineSpace && referenceLineSpace.pos.character > previousChar) {
    // previously before the colon - cap new char at the colon pos
    if (currentLineSpace && newChar > currentLineSpace.pos.character) {
      newChar = currentLineSpace.pos.character;
    }
  }

  return newChar;
}

// This method is called when your extension is deactivated
export function deactivate() {}


// function alignBlockForLine(editor: vscode.TextEditor, range: vscode.Range) {
//   let positions = [];
//   for (let i = range.start.line; i >= 0; i--) {
//     let match = editor.document.lineAt(i).text.match(" = ");
//     if (match?.index !== undefined) {
//       positions.push([i, match.index]);
//     } else {
//       break;
//     }
//   }
//   for (let i = range.start.line + 1; i < editor.document.lineCount; i++) {
//     let match = editor.document.lineAt(i).text.match(" = ");
//     if (match?.index !== undefined) {
//       positions.push([i, match.index]);
//     } else {
//       break;
//     }
//   }

//   alignPositions(editor, positions);

// }

function alignBlockEq(editor: vscode.TextEditor, blockStart: number): number {
  let positions = [];

  let i = blockStart;
  for (; i < editor.document.lineCount; i++) {
    const line = editor.document.lineAt(i).text;
    let match = line.match(" = ");
    if (match?.index !== undefined) {
      if (!line.match(/^[^()]* = /)) {
        // don't include assignments in for loops
        i = i+1;
        break;
      }
      positions.push([i, match.index+1]);
      if (line.match(/\{$/)) {
        // Trailing curly brace means new scope, so stop the current block here.
        i = i+1;
        break;
      }
    } else {
      i = i+1;
      break;
    }
  }

  alignPositions(editor, positions, 'before');

  return i;
}

function alignBlockColon(editor: vscode.TextEditor, blockStart: number): number {
  let positions = [];

  let i = blockStart;
  for (; i < editor.document.lineCount; i++) {
    const line = editor.document.lineAt(i).text;
    let match = line.match(/[^ ]: /);
    if (match?.index !== undefined) {
      if (!line.match(/^[^()]*: /)) {
        // don't include assignments in for loops
        i = i+1;
        break;
      }
      if (line.endsWith("{") || line.endsWith("[")) {
        // don't align with beginning of multiline object or array, or with function declaration
        i = i+1;
        break;
      }
      if (line.length <= match.index+2) {
        break;
      }
      positions.push([i, match.index+2]);
    } else {
      i = i+1;
      break;
    }
  }

  alignPositions(editor, positions, 'after');

  return i;
}

function alignPositions(editor: vscode.TextEditor, positions: number[][], dir: 'before'|'after') {
  if (positions.length === 0) {
    return;
  }
  let max = Math.max(...positions.map(([i, idx]) => idx));
  let decoration = decorations.get(editor.document.fileName)!;
  if (decoration === undefined) {
    decoration = new Map();
    decorations.set(editor.document.fileName, decoration);
  }
  let addedSpace = addedSpaces.get(editor.document.fileName)!;
  if (addedSpace === undefined) {
    addedSpace = new Map();
    addedSpaces.set(editor.document.fileName, addedSpace);
  }
  positions.forEach(([i, idx]) => {
    const pos = new vscode.Position(i, idx);
    addedSpace.set(i, {pos, count: max - idx});
    if (max - idx === 0) {
      return;
    }
    decoration.set(i, {
      range: new vscode.Range(pos, pos),
      renderOptions: {
        [dir]: {
          contentText: '\u00a0'.repeat(max - idx)
        }
      }
    });
  });
}

function checkFullEditorDocument(editor: vscode.TextEditor) {
  decorations.delete(editor.document.fileName);
  addedSpaces.delete(editor.document.fileName);
  for (let i = 0; i < editor.document.lineCount;) {
    i = alignBlockEq(editor, i);
  //   if (line.text.includes(" = ") && line.text.match(/^[^()]* = /) !== null) {
  //     console.log("found eq at line " + i);
  //     if (blockStart === undefined) {
  //       blockStart = i;
  //     }
  //   }
  //   else {
  //     if (blockStart !== undefined) {
  //       console.log("aligning since " + blockStart);
  //       alignBlock(editor, blockStart);
  //       blockStart = undefined;
  //     }
  //   }
  }
  for (let i = 0; i < editor.document.lineCount;) {
    i = alignBlockColon(editor, i);
  }

  // if (blockStart !== undefined) {
  //   alignBlock(editor, blockStart);
  //   blockStart = undefined;
  // }

  var decoration = decorations.get(editor.document.fileName);
  if (decoration === undefined) {
    return;
  }
  editor.setDecorations(decorationType, [...decoration.values()]);
}

