// hot garbage incoming

// CONFIG

const UPLOADDIR = "upload/d/";
const SIZELIMIT = 100 * 1024 * 1024; // 100mb
const STORAGENAME = "fileDB.json";
const FILETTL = 1 * 24 * 60 * 60 * 1000 // 1 day in ms
const HASHROUNDS = 10;
const PASSPHRASE = "PUTYOURPASSWORDHEREDONTLEAVEITBLANK";

/////////////////////////////////////////////////////////

var express = require('express');
var app = express();
var multer = require("multer");
var bodyParser = require("body-parser");
var nanoid = require("nanoid");
var cors = require("cors");
var lowdb = require("lowdb");
var fileSync = require("lowdb/adapters/FileSync");
var bcrypt = require("bcrypt");
var fs = require("fs");
var crypto = require("crypto");

/////////////////////////////////////////////////////////

var adapter = new fileSync(STORAGENAME, {
	serialize: (data)=>{
		return encrypt(JSON.stringify(data), PASSPHRASE);
	},
	deserialize: (data)=>{
		return JSON.parse(decrypt(data, "camellia-256-cbc", PASSPHRASE));
	}
});
var db = lowdb(adapter);

db.defaults({files: []}).write();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

updateFiles();

var storage = multer.diskStorage({
	destination: UPLOADDIR,
	filename: function(req, file, cb) {

		var pwdHash = "";

		if (req.body.password)
		{
			pwdHash = bcrypt.hashSync(req.body.password, HASHROUNDS);
		}

		var thing = file.originalname.split(".");
		var lmao = nanoid(5) + Date.now() + (thing.length > 1 ? "." + thing[thing.length-1] : "");

		db.get("files").push({id: lmao, pwdHash: pwdHash, expires: (Date.now() + FILETTL)}).write();
		cb(null, lmao);

	},
});

var upload = multer({
	storage: storage,
	limits: { fileSize: SIZELIMIT }
}).single("file");

app.post("/upload", async function(req, res){

	await updateFiles();

	upload(req, res, err => {
		if(err)
		{
			res.send(err.toString());
			return;
		}

		var link = req.protocol + "://" + req.get("host") + "/d/" + req.file.filename;

		res.send("<a href=" + link + ">" + link + "</a>");
		return;
	});
});

app.get('/', function(request, response) {
  	response.sendFile(__dirname + '/views/index.html');
});

app.get("/d/*", async function(req, res){
	var fn = req.url.replace("/d/", "");
	var fp = __dirname + "/upload" + req.url;

	var search = await db.get("files").find(function(data){
		return data.id == fn;
	}).value();
	
	if (search)
	{
		if (search.pwdHash) // form is minified and escaoed version of form.html
		{
			res.send("<body><form action=\"/verify/+ADDTHETHINGHERE\" method=\"post\">Password: <input type=\"text\" name=\"verifyAttempt\"><br><button type=\"submit\">Submit</button></form></body>".replace("+ADDTHETHINGHERE", fn));
			return;
		}
		res.sendFile(fp);
		return;
	}
	
	fs.exists(fp, exists=>{ // deletes if file exists but does not exist in the record
		if (exists)
		{
			fs.unlink(fp, err=>{
				if (err)
				{
					console.error(err.toString());
				}
			});
		}
	});

	res.sendStatus(404);
	
});

app.post("/verify/*", async function(req, res){
	var fn = req.url.replace("/verify/", "");

	var search = await db.get("files").find(function(data){
		return data.id == fn;
	}).value();

	if (!search)
	{
		res.sendStatus(404);
		return;
	}

	if (!req.body.verifyAttempt.trim())
	{
		res.redirect("back");
		return;
	}

	bcrypt.compare(req.body.verifyAttempt.trim(), search.pwdHash, (err, same)=>{

		if (err)
		{
			console.error(err.toString());
			return;
		}

		if (same)
		{
			// res.sendFile(__dirname + "/upload/d/" + fn);
			fs.readFile(__dirname + "/upload/d/" + fn, function(err, data){
				if (err)
				{
					console.error(err.toString());
					return;
				}

				var decryptedFile = decrypt(data.toString(), "aes-256-cbc", req.body.verifyAttempt.trim()); // do not use this if you're allowing large file sizes

				if (typeof(decryptedFile) === undefined)
				{
					res.redirect("back");
				}

				res.setHeader("Content-disposition", "attachment; filename=" + fn);
				res.setHeader("Content-type", "text/plain");

				res.send(decryptedFile);
			});
			return;
		}

		res.redirect("back");
	});
	
	// console.log(req.url);
});

app.get("/limits", function(req, res){
	res.send({
		SIZELIMIT: SIZELIMIT,
		FILETTL: FILETTL
	});
});

app.get("*", function(req, res){
	res.send("<h1>rip</h1>");
});

var listener = app.listen(process.env.PORT || 6699, function() {
  	console.log('Your app is listening on port ' + listener.address().port);
});


function updateFiles()
{
	db.get("files").remove(function(data){
		var meme = data.expires <= Date.now() && data.expires != 0;
		if (meme)
		{
			fs.unlink(__dirname + "/" + UPLOADDIR + data.id, err=>{
				if (err)
				{
					console.error(err.toString());
					return false;
				}
				
				console.log("deleted " + file.filename);
			});
		}
		return meme;
	}).write();
}


function encrypt(plaintext, pass)
{
	if (!plaintext || !pass)
	{
		return;
	}
	
	try
	{
		var key = crypto.createHash("sha256").update(pass).digest();
		var iv = crypto.randomBytes(16);
		var cipher = crypto.createCipheriv("camellia-256-cbc", key, iv);

		var a = cipher.update(plaintext, "utf-8", "hex");
		a += cipher.final("hex")

		return iv.toString("hex") + a;
	}
	catch(e)
	{
		console.error(e.toString());
		return;
	}
}

function decrypt(encrypted, algo,  pass) // encrypted = ciphertext + iv
{
	if (!encrypted || !pass)
	{
		return;
	}

	try
	{
		var key = crypto.createHash("sha256").update(pass).digest();
		var iv = Buffer.from(encrypted.slice(0, 32), "hex");
		var decipher = crypto.createDecipheriv(algo, key, iv);

		var a = decipher.update(encrypted.slice(32), "hex");
		a += decipher.final("utf-8");
		return a;
	}
	catch(e)
	{
		console.error(e.toString());
		return;
	}
}