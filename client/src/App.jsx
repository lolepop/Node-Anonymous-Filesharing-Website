import React, { Component } from 'react';
import axios from "axios";
import { withStyles } from '@material-ui/core/styles';
import Button from "@material-ui/core/Button";
import CloudIcon from "@material-ui/icons/CloudUpload";
import LinearProgress from '@material-ui/core/LinearProgress';
import crypto from 'crypto';

// CONFIG

const SERVERURL = "http://localhost:6699";

/////////////////////////////////////////////////////////


function encrypt(plaintext, pass)
{
	if (!plaintext || !pass)
	{
		return;
	}

	var key = crypto.createHash("sha256").update(pass).digest();
	var iv = crypto.randomBytes(16);
	var cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

	var a = cipher.update(plaintext, "utf-8", "hex");
	a += cipher.final("hex")

	return iv.toString("hex") + a;
}

class App extends React.Component {


	constructor(props) {
		super(props);

	this.state = {
			fileSel: "",
			vl: true,
			vl2: false,
			pct: 0,
			limits: {}
		};

	this.textChanged = this.textChanged.bind(this);
	this.meme = this.meme.bind(this);
	this.updateFile = this.updateFile.bind(this);
	this.uploadProg = this.uploadProg.bind(this);
	this.componentDidMount = this.componentDidMount.bind(this);
	}

	textChanged(e)
	{
		var isValid = true;
		const input = e.target.value;

		// if (input.length < 0 || input.includes("meme"))
		// 	isValid = false;

		this.setState(function() {
			return {vl: isValid};
		});
	}

	componentDidMount() {
		// axios.get("http://localhost:6699/ass").then(res => console.log(res)).catch(err => console.log(err));
		axios.get(SERVERURL + "/limits").then(res=>{
			console.log(res.data);
			this.setState(function(){
				return {limits: res.data}
			});
		}).catch(err => console.error(err));
	}

	
	meme(e)
	{

		var okFile = true;

		if (e.target.files.length !== 1 || e.target.files[0].size > this.state.limits.SIZELIMIT)
		{
			okFile = false;
		}

		this.setState(function(){
			return {vl2: okFile};
		});
	}

	updateFile(f)
	{
		this.setState(() => {
			return {fileSel: f.data};
		});
	}

	uploadProg(curr, total)
	{
		this.setState(() => {
			if (curr/total === 1)
				return {pct: 0}
			return {pct: (curr/total)*100}
		});
	}

	sendFile(e)
	{

		const cfg = {onUploadProgress: e => {this.uploadProg(e.loaded, e.total) + '%'}};
		
		var filereader = new FileReader();

		var file = e.target[1].files[0];
		var password = e.target[0].value.trim();

		filereader.onload = function(){
			if (password)
			{
				var a = filereader.result.split(",");
				var data = Buffer.from(a[1], "base64").toString("utf-8");

				var blob = new Blob([encrypt(data, password)]);
				file = new File([blob], file.name, {type: file.type, lastModified: file.lastModified});
			}

			var postData = new FormData();
			postData.append("password", password);
			postData.append("file", file);

			axios.post(SERVERURL + "/upload", postData, cfg).then(res => {
				this.updateFile(res);
			});
		}.bind(this);

		filereader.readAsDataURL(e.target[1].files[0]);
	}

	render() {
		return (
		<div>
			hii (File will live for: {this.state.limits.FILETTL / 24 / 60 / 60 / 1000} day)<br/>
			The year now is {new Date().getTime()/31536000000+1970}
			<br/>
			<br/>
			Password encryption causes file size inflation so it might be too larrge and be rejected by the server (zip and password protect if you don't want that) 

			<br/><br/>
			<form onSubmit={e => {
				this.sendFile(e);
				e.preventDefault();
				e.stopPropagation();
			}}>
				Password: <input onChange={e => this.textChanged(e)} name="password" type="text"/>

				<br/>
				{this.state.vl ? "work" : "not work"} <br/><br/>

				<input type="file" onChange={e => this.meme(e)}/> <br/><br/>
				<Button variant="contained" color="default" disabled={!(this.state.vl2 && this.state.vl)} type="submit">Send it <CloudIcon/></Button>
			</form>

			<br/>

			<LinearProgress variant="determinate" value={this.state.pct}></LinearProgress> {Math.floor(this.state.pct) + '%'}

			<br/><br/>
			<div dangerouslySetInnerHTML={{__html: this.state.fileSel}}/>
		</div>
		);
	}
}

export default App;
