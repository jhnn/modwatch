 <?php
$servername = "mysql09.000webhost.com";
$username = "a8932629_user";
$password = "sja8dll3";
$dbname = "a8932629_db02";

// Check if the user/redditor parameter is provided
if(!key_exists('u', $_GET)){
	throw new Exception("You must supply a 'u' parameter in the request");
}
$user = $_GET['u'];

$conn = mysqli_connect($servername, $username, $password, $dbname);
if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

// Query for the last time this mod was updated, if fetch fails create a new entry
$query = "SELECT TIMESTAMPDIFF(HOUR, lastupdate ,CURRENT_TIMESTAMP()) FROM Moderators WHERE name = ? LIMIT 1";
if($stmt = $conn->prepare($query)){
	$stmt->bind_param('s', $user);
	$stmt->execute();
    $stmt->bind_result($lastupdate);
	$modexists = $stmt->fetch();
	$stmt->close();
	
    if ($modexists) {
		// Load from DB if last update was less than two days ago, otherwise get data from the web
		if($lastupdate < 48){
			$json = loadFromDB($conn, $user);
		}
		else
		{
			// First update the timestamp to prevent multiple concurrent updates.
			if($stmt = $conn->prepare("UPDATE Moderators SET lastupdate = CURRENT_TIMESTAMP() WHERE name = ? LIMIT 1")){
				$stmt->bind_param('s', $user);
				$stmt->execute();
				$stmt->close();
				// Delete all current entries and load new ones from the web.
				if($stmt = $conn->prepare("DELETE FROM ModSubs WHERE moderator = ?")){
					$stmt->bind_param('s', $user);
					$stmt->execute();
					$stmt->close();
					$json = loadFromURL($conn, $user);
				}
				else
				{
					// If the information would have been crucial the previous state should be restored here.
				}
			}
		}
    }
	else
	{
		// Create new entry and get data from the web
		if($stmt = $conn->prepare("INSERT INTO Moderators (name) VALUES (?)")){
			$stmt->bind_param('s', $user);
			$stmt->execute();
			$stmt->close();
			$json = loadFromURL($conn, $user);
		}
	}
}

mysqli_close($conn);

echo $json;

// Load the subreddits of a moderator from the web
function loadFromURL($conn, $user){
	$url = 'https://www.reddit.com/user/' . $user;
	$response = curl($url);

	$doc = new DOMDocument();
	if(@$doc->loadHTML($response)){
		$div = $doc->getElementById('side-mod-list');
		$arr = $div->getElementsByTagName("a");
		$subreddits = array();
		foreach($arr as $item) {
			$href =  $item->getAttribute("href");
			$subreddit = substr($href, 3, -1);
			$subreddits[] = '"'.$subreddit.'"';
			if($stmt = $conn->prepare("INSERT INTO ModSubs (moderator, subreddit) VALUES (?, ?)")){
				$stmt->bind_param('ss', $user, $subreddit);
				$stmt->execute();
				$stmt->close();
			}
		}
		return '{"subreddits": ['.implode(',',$subreddits).']}';
	}
	else
	{
		return '{"subreddits": []}';
	}
}

// Load the subreddits of a moderator from the database
function loadFromDB($conn, $user){
	if($stmt = $conn->prepare('SELECT subreddit FROM ModSubs WHERE moderator = ?')){
		$stmt->bind_param('s', $user);
		$stmt->execute();
		$stmt->bind_result($subreddit);
		
		$subreddits = array();
		while ($stmt->fetch()) {
			$subreddits[] = '"'.$subreddit.'"';
		}
		
		$stmt->close();
		return '{"subreddits": ['.implode(',',$subreddits).']}';
	}
	else
	{
		return '{"subreddits": []}';
	}
}

function curl($url) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
  curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
  $result = curl_exec($ch);
  curl_close($ch);
  return $result;
}

?> 