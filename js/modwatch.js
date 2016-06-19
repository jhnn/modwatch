var fontCaviarDreams;

var StateEnum = Object.freeze({START: 1, RUNNING: 2, FINNISHED: 3});
var currentState = StateEnum.START;

var currentSubreddit;
var currentSubredditSize;
var currentRunID = 0;
// Stores strings for the progress view
var progress = ["",""];
// Store data in format [name, size, colorHue, currentAngle, targetAngle, distancePercentage]
var drawnSubreddits = Array();

function preload() {
	fontCaviarDreams = loadFont('fonts/CaviarDreams.ttf');
}	

function setup() {
	var canvas = createCanvas(720, 720);
	canvas.parent('canvasContainer');
	clearCanvas();
	
	textFont(fontCaviarDreams);
	textAlign(CENTER);
	colorMode(HSL);
	
	drawInformation("modwatch for reddit", "track mod related subreddits");
}

function draw() {
	switch(currentState){
		case StateEnum.RUNNING:
			drawnRelatedSubreddits();
			drawProgress(progress[0], progress[1]);
			break;
		case StateEnum.FINNISHED:
			drawnRelatedSubreddits();
			drawCurrentSubreddit();
		default:
	}
}

$('#domainform').on('submit', function(event){
	event.preventDefault();
	var runID = ++currentRunID;
	checkStateClean(runID);
});

function checkStateClean(runID){
	if(currentState == StateEnum.RUNNING){
		setTimeout(function(){
			checkStateClean(runID);
		}, 200);
	}
	else
	{
		currentState = StateEnum.START;
		// Clear the buttons and result div
		$("#saveimage").html("");
		$("#showraw").html("");
		$("#rawresults").html("");
		collectSubredditData(runID);
	}
}

function collectSubredditData(runID){
	// Sanitize input
	var inputname = $('#searchsubreddit').val();
	inputname = inputname.substr(inputname.lastIndexOf("/") + 1, inputname.length);
	if(inputname.length > 21){
		drawInformation("error", "subreddit name too long");
		return;
	}
	var valid = /^[a-zA-Z0-9]\w{2,20}$/.test(inputname);
	// Test length invalid, subreddit name and language subreddit name invalid
	if(inputname.length > 21 || !(/^[a-zA-Z0-9]\w{2,20}$/.test(inputname) || /^[a-zA-Z]{2,3}$/.test(inputname))){
		
		drawInformation("error", "invalid subreddit name");
		return;
	}
	// This query is merely to get the correct case/capitalization of the subreddit
	var subredditurl = "http://www.reddit.com/r/" + inputname + "/about.json";
	$.getJSON(subredditurl, function foo(data) {
		drawInformation("loading...", "searching for mods");
	})
	.then(function(data){
			var fullurl = data.data.url;
			currentSubreddit = fullurl.substring(0, fullurl.length - 1);
			searchsubreddit(currentSubreddit, runID);
		},
		function(error){
			clearCanvas();
			// The subreddit may not exist or be unavailable due to e.g. quarantine
			if(error.status == 0){
				drawInformation("error", "could not find /r/" + $('#searchsubreddit').val());
			} else {
				drawInformation("error " + error.status, error.statusText);
			}
		}
	);
}

// Search the moderators of a subreddit
function searchsubreddit(subreddit, runID){
	if(runID != currentRunID){
		return;
	}
	var fullurl = "http://www.reddit.com" + subreddit + "/about/moderators.json?jsonp=?";
	var modnames = [];

	$.getJSON(fullurl, function foo(data) {
		$.each( data.data.children, function (i, post) {
			// Exclude this bot, skews the data
			if(post.name != "AutoModerator"){
				modnames.push(post.name);
			}
		})
	})
	.then(function() {
		drawInformation("searching for mods", "finished collecting mods");
		processmoderators(modnames, runID);
	}, function() {
		drawInformation("error", "could not retrive mods");
	});
}

// Look up the subreddit each mod is moderating
function processmoderators(modnames, runID){
	if(runID != currentRunID){
		return;
	}
	var submodmap = new Map();
	currentSubredditSize = modnames.length;
	var acc = currentSubredditSize - 1;
	drawnSubreddits = Array();
	currentState = StateEnum.RUNNING;
	clearCanvas();
	progress = ["mods " + modnames.length, "searching subreddits"];
	
	processmoderatorsrecoursive(modnames, submodmap, acc, runID);
}

function processmoderatorsrecoursive( modnames, submodmap, acc, runID){
	if(runID != currentRunID){
		currentState = StateEnum.FINNISHED;
		return;
	}
	if(acc >= 0){
		$.getJSON("../php/modwatchdb.php?u=" + modnames[acc], function (data) {
			$.each( data.subreddits, function (i, data) {
				data = "/r/" + data;
				// Create new entry in the map or increase counter
				if(submodmap.has(data)){
					var number = submodmap.get(data) + 1;
					submodmap.set(data, number);
					updatedrawnSubreddits(data, number);
				} else {
					submodmap.set(data, 1);
				}
			});
			submodmap.delete(currentSubreddit);
			finalizedrawnSubreddits();
			progress = ["mods " + (modnames.length - acc) + "/" + modnames.length, "subreddits " + submodmap.size];
		})
		.then(function() {
			processmoderatorsrecoursive(modnames, submodmap, acc - 1, runID);
		}, function() {
			alert("error trying to read a redditors profile");
			processmoderatorsrecoursive(modnames, submodmap, acc - 1, runID);
		});
	}
	else
	{
		var sortedsubs = [];
		for (var [key, value] of submodmap.entries()) {
			if(value > 1){
				sortedsubs.push([key, value])
			}
		};
		sortedsubs.sort(function(a, b) {
			return b[1] - a[1];
		});
		// Create buttons to save image and expand raw data
		$("#saveimage").html("<button id='saveimagebutton' onclick='saveImage()'>Save image</button>");
		$("#showraw").html("<button id='showrawbutton' onclick='expandRawData()'>Show raw data</button>");
		for(var l = 0; l < sortedsubs.length; l++){
			$("#rawresults").append('<p>' + sortedsubs[l][0] + ": " + sortedsubs[l][1] + '</p>');
		}
		currentState = StateEnum.FINNISHED;
	}
}

function saveImage(){
	saveCanvas("modwatch_"+currentSubreddit.substring(3), 'png');
}

function expandRawData() {
	$("#rawresults").slideToggle(100);
}

/// Functions for updating the data

function updatedrawnSubreddits(subreddit, number) {
	// Check whether the entry already exists and update
	for(i = 0; i < drawnSubreddits.length; i++){
		if(drawnSubreddits[i][0] == subreddit){
			drawnSubreddits[i][1] = number;
			sortdrawnSubreddits();
			return;
		}
	}
	// Insert if less than ten entries
	if(drawnSubreddits.length < 10){
		drawnSubreddits.push([subreddit, number, random(256), -1, -1, 0]);
		sortdrawnSubreddits();
	}
	else
	{
		// Replace smallest entry if this is larger
		var min = drawnSubreddits[0][1];
		if(number > min){
			drawnSubreddits[0] = [subreddit, number, random(256), -1, -1, 0];
			sortdrawnSubreddits();
		}
	}
}

function sortdrawnSubreddits(){
	drawnSubreddits.sort(function(a, b) {
		return a[1] - b[1];
	});
}

function finalizedrawnSubreddits(){
	var deltaAngle = 2 * Math.PI / drawnSubreddits.length;
	// Set angles depending on the order of the array
	for(var j = drawnSubreddits.length - 1; j >= 0; j--){
		drawnSubreddits[j][4] = (drawnSubreddits.length - (j + 1)) * deltaAngle;
		if(drawnSubreddits[j][3] == -1){
			drawnSubreddits[j][3] = drawnSubreddits[j][4];
		}
	}
}

/// Functions for drawing the data

function drawnRelatedSubreddits(){
	clearCanvas();
	for(i = 0; i < drawnSubreddits.length; i++){
		drawRelatedSubreddit(i);
		drawnSubreddits[i][3] += (drawnSubreddits[i][4] - drawnSubreddits[i][3])/2;
		if(drawnSubreddits[i][5] < 1){
			drawnSubreddits[i][5] += 0.1;
		}
	}
}

function drawRelatedSubreddit(index){
	var relSize = drawnSubreddits[index][1] / currentSubredditSize;
	var px = 360 + Math.sin(drawnSubreddits[i][3]) * 250 * drawnSubreddits[index][5];
	var py = 360 + Math.cos(drawnSubreddits[i][3]) * 250 * drawnSubreddits[index][5];
	
	stroke(drawnSubreddits[index][2], 50, 95);
	strokeWeight(100 * relSize);
	line(360,360, px, py);
	noStroke();
	
	fill(drawnSubreddits[index][2], 85, 90);
	ellipse(px, py, 200 * relSize, 200 * relSize);
	
	textSize(18);
	fill(0, 0, 0);
	text(drawnSubreddits[index][0], px, py);
	text(drawnSubreddits[index][1], px, py + 30);
}

var progressAngle = [0, 0, 1];
function drawProgress(textTop, textBottom){
	drawCenterCircle(textTop, textBottom);
	
	stroke(0, 0, 90);
	strokeWeight(2);
	line(280, 360, 440, 360);
	noStroke();
	
	fill(0, 0, 50);
	ellipse(360 + progressAngle[1] * 90, 360 + progressAngle[2] * 90, 12, 12);
	
	progressAngle[0] += 0.06;
	progressAngle[1] = Math.sin(progressAngle[0]);
	progressAngle[2] = Math.cos(progressAngle[0]);
	
	fill(0, 0, 90);
	ellipse(360 + progressAngle[1] * 90, 360 + progressAngle[2] * 90, 14, 14);
}

function drawInformation(infotop, infobot){
	clearCanvas();
	drawCenterCircle(infotop, infobot);
	
	stroke(0, 0, 90);
	strokeWeight(2);
	line(180, 360, 540, 360);
	noStroke();
}

function drawCurrentSubreddit(){
	drawCenterCircle(currentSubreddit, currentSubredditSize);
}

function drawCenterCircle(upperText, lowerText){
	fill(0, 0, 30);
	ellipse(360, 360, 200, 200);
	fill(0, 0, 100);
	textSize(20);
	text(upperText, 360, 355);
	text(lowerText, 360, 380);
}

function clearCanvas() {
	background(0,0,60);
	noStroke();
}