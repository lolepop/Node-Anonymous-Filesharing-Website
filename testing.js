var crypto = require("crypto");



var password = "asdf";

var key = crypto.createHash("sha256").update(password).digest();

console.log("hash:", key);

var iv = crypto.randomBytes(16).toString("hex");

var cipher = crypto.createCipheriv("camellia-256-cbc", key, Buffer.from(iv, "hex"));

console.log("iv hex:", iv);

var a = cipher.update("succ");
a = cipher.final("hex");

var final = iv + a;
console.log("encrypted + iv:", final);


var decipher = crypto.createDecipheriv("camellia-256-cbc", key, Buffer.from(final.slice(0, 32), "hex"));
decipher.update(a, "hex");
var b = decipher.final("utf8");
console.log("decrypted: " + b);
