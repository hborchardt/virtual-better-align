// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const decorationType = vscode.window.createTextEditorDecorationType({
});
const decorations = new Map();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	//console.log('Congratulations, your extension "virtual-better-align" is now active!');

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

  disposable = vscode.workspace.onDidOpenTextDocument(evt => {
    const editor = vscode.window.visibleTextEditors.find(editor => editor.document === evt);
    if (editor === undefined) {
      return;
    }
    checkFullEditorDocument(editor);
  });
	context.subscriptions.push(disposable);

  disposable = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor === undefined) {
      return;
    }
    checkFullEditorDocument(editor);
  });
	context.subscriptions.push(disposable);
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
      if (line.length <= match.index+2) {
        break;
      }
      positions.push([i, match.index+2]);
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

  alignPositions(editor, positions, 'after');

  return i;
}

function alignPositions(editor: vscode.TextEditor, positions: number[][], dir: 'before'|'after') {
  let max = Math.max(...positions.map(([i, idx]) => idx));
  let decoration = decorations.get(editor.document.fileName);
  if (decoration === undefined) {
    decoration = new Map();
    decorations.set(editor.document.fileName, decoration);
  }
  positions.forEach(([i, idx]) => {
    const pos = new vscode.Position(i, idx);
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
  
  editor.setDecorations(decorationType, [...decorations.get(editor.document.fileName).values()]);
}

