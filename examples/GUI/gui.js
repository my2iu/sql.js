var execBtn = document.getElementById("execute");
var clearBtn = document.getElementById("clear");
var outputElm = document.getElementById('output');
var errorElm = document.getElementById('error');
var commandsElm = document.getElementById('commands');
var dbFileElm = document.getElementById('dbfile');
var savedbElm = document.getElementById('savedb');
var moreBtn = document.getElementById('more');
var lessBtn = document.getElementById('less');
var moreButtons = document.getElementById('moreButtons');

// Start the worker in which sql.js will run
var worker = new Worker("dist/worker.sql-wasm-debug.js");
worker.onerror = error;

// Open a database
worker.postMessage({ action: 'open' });

// Connect to the HTML element we 'print' to
function print(text) {
	outputElm.innerHTML = text.replace(/\n/g, '<br>');
}

function status(msg) {
	console.log(msg);
	errorElm.classList.remove('error');
	errorElm.style.height = '2em';
	errorElm.textContent = msg;
}

function statuserr(msg) {
	console.log(msg);
	errorElm.classList.add('error');
	errorElm.style.height = '2em';
	errorElm.textContent = msg;
}

function error(e) {
	statuserr(e.message);
}

function noerror() {
	errorElm.style.height = '0';
}

// Run a command in the database
function execute(commands) {
	tic();
	worker.onmessage = function (event) {
                var err = event.data.error;
                if (!!err) {
		   toc("Executing SQL");
	 	   statuserr(err);
                } else {
		   noerror('');
		}
		var results = event.data.results;
		if (!!results) {
			outputElm.innerHTML = "";
			for (var i = 0; i < results.length; i++) {
				outputElm.appendChild(tableCreate(results[i].columns, results[i].values));
			}
		}
		toc("Executing SQL");

	}
	worker.postMessage({ action: 'exec', sql: commands });
	status("Fetching results...");
}

// Create an HTML table
var tableCreate = function () {
	function valconcat(vals, tagName) {
		if (vals.length === 0) return '';
		var open = '<' + tagName + '>', close = '</' + tagName + '>';
		return open + vals.join(close + open) + close;
	}
	return function (columns, values) {
		var tbl = document.createElement('table');
		var html = '<thead>' + valconcat(columns, 'th') + '</thead>';
		var rows = values.map(function (v) { return valconcat(v, 'td'); });
		html += '<tbody>' + valconcat(rows, 'tr') + '</tbody>';
		tbl.innerHTML = html;
		return tbl;
	}
}();

// Execute the commands when the button is clicked
function execEditorContents() {
	noerror()
	execute(editor.getValue() + ';');
}
execBtn.addEventListener("click", execEditorContents, true);

clearBtn.addEventListener("click", function() { editor.setValue('');});

// Performance measurement functions
var tictime;
if (!window.performance || !performance.now) { window.performance = { now: Date.now } }
function tic() { tictime = performance.now() }
function toc(msg) {
	var dt = performance.now() - tictime;
	console.log((msg || 'toc') + ": " + dt + "ms");
}

// Add syntax highlihjting to the textarea
var editor = CodeMirror.fromTextArea(commandsElm, {
	mode: 'text/x-mysql',
	viewportMargin: Infinity,
	indentWithTabs: true,
	smartIndent: true,
	lineNumbers: true,
	matchBrackets: true,
	autofocus: true,
	extraKeys: {
		"Ctrl-Enter": execEditorContents,
		"Ctrl-S": savedb,
	}
});

// Load a db from a file
dbFileElm.onchange = function () {
	var f = dbFileElm.files[0];
	var r = new FileReader();
	r.onload = function () {
		worker.onmessage = function () {
			toc("Loading database from file");
			// Show the schema of the loaded database
			editor.setValue("SELECT `name`, `sql`\n  FROM `sqlite_master`\n  WHERE type='table';");
			execEditorContents();
		};
		tic();
		try {
			worker.postMessage({ action: 'open', buffer: r.result }, [r.result]);
		}
		catch (exception) {
			worker.postMessage({ action: 'open', buffer: r.result });
		}
	}
	r.readAsArrayBuffer(f);
}

// Save the db to a file
function savedb() {
	worker.onmessage = function (event) {
		toc("Exporting the database");
		var arraybuff = event.data.buffer;
		var blob = new Blob([arraybuff]);
		var a = document.createElement("a");
		document.body.appendChild(a);
		a.href = window.URL.createObjectURL(blob);
		a.download = "sql.db";
		a.onclick = function () {
			setTimeout(function () {
				window.URL.revokeObjectURL(a.href);
			}, 1500);
		};
		a.click();
	};
	tic();
	worker.postMessage({ action: 'export' });
}
savedbElm.addEventListener("click", savedb, true);

// More and less buttons
moreButtons.style.display = 'none';
moreBtn.addEventListener('click', () => {
	moreButtons.style.display = 'inline';
	moreBtn.style.display = 'none';
});
lessBtn.addEventListener('click', () => {
	moreButtons.style.display = 'none';
	moreBtn.style.display = 'inline-block';
});

function fetchdb(file)
{
	fetch(file)
		.then((response) => response.arrayBuffer())
		.then((arrbuff) => {
			worker.onmessage = function () {
				toc("Loading database from file");
				// Show the schema of the loaded database
				editor.setValue("SELECT `name`, `sql`\n  FROM `sqlite_master`\n  WHERE type='table';");
				execEditorContents();
			};
			tic();
			try {
				worker.postMessage({ action: 'open', buffer: arrbuff }, [arrbuff]);
			}
			catch (exception) {
				worker.postMessage({ action: 'open', buffer: arrbuff });
			}
	});
}

document.getElementById('loadWorld').onclick = function() {
	fetchdb('world.db');
}

document.getElementById('loadImdb').onclick = function() {
	fetchdb('imdb_popular_movies_2018.db');
}
