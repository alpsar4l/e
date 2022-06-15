const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');
const moment = require('moment');
const nmea = require("nmea-simple");

// csv
const fs = require("fs");
const { stringify } = require("csv-stringify");
const filename = "telemetry_logs.csv";
const writableStream = fs.createWriteStream(filename);


require('dotenv').config();

const corsOptions = {
    origin: [
        "http://localhost:1231",
        "http://localhost:9000",
        "http://localhost:3000",
        "http://localhost:9999",
        "http://localhost:10000"
    ],
    optionsSuccessStatus: 200,
};

const con = mysql.createConnection({
    host: "127.0.0.1",
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: "eva"
});

con.connect(function(err) {
    if (err)
        throw err;

    console.log("Veritabanına bağlanıldı!");
});

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'build')));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.get('/api/get_csv1', function (req, res) {
    const columns = [
        "id",
        "vehicle",
        "speed",
        "voltage",
        "battery",
        "location",
        "engine_temperature",
        "battery_temperature",
        "cells_temperature",
        "date"
    ];

    const stringifier = stringify({ header: true, columns: columns });

    con.query("SELECT * FROM logs ORDER BY id DESC LIMIT 5000", function (err, result, fields) {
        if (err) {
            return console.log(err.message);
        }

        result.forEach((row) => {
            stringifier.write(row);
        });
    });

    stringifier.pipe(writableStream);

    res.download(__dirname + "/telemetry_logs.csv", function(err) {
        if (err) {
            console.log(err);
        }
    })
});

app.get('/api/muz.txt', function (req, res) {
    con.query("SELECT * FROM logs ORDER BY id DESC LIMIT 5000", function (err, result, fields) {
        let response = "";

        result.forEach((item) => {
            if (item.date) {
                response += `${moment.unix(item.date).format()};&nbsp;&nbsp;&nbsp;${item.speed}, ${item.voltage}, ${item.battery}, ${item.location}, ${item.engine_temperature}, ${item.battery_temperature}, ${item.cells_temperature};<br>`;
            }
        });

        res.send(response);
    });
});

app.get('/api/cikita.txt', function (req, res) {
    con.query("SELECT * FROM logs ORDER BY id DESC LIMIT 5000", function (err, result, fields) {
        let response = "";

        result.forEach((item) => {
            if (item.date) {
                response += `
                    TIME: ${moment.unix(item.date).format()} <br>
                    DATA: ${item.speed}, ${item.voltage}, ${item.battery}, ${item.location}, ${item.engine_temperature}, ${item.battery_temperature}, ${item.cells_temperature}
                    <br>---<br>
                `;
            }
        });

        res.send(response);
    });
});

app.get('/api/collect/latest', function (req, res) {
    con.query("SELECT * FROM logs ORDER BY id DESC LIMIT 0,1", function (err, result, fields) {
        if (err)
            return res.send({
                status: 89,
                message: "Veritabanı cortladı"
            });

        res.send({
            status: 64,
            message: result[0],
            location: result[0].location.split(",")
        });
    });
});

app.post('/api/send/pembe_mezarlik', function (req, res) {
    // @ts-ignore
    const date = Math.floor(new Date() / 1000);
    const data = req.query.data.split("_");

    if (data.length !== 6) {
        res.send({
            status: 256,
            message: "Eksik veri gönderildi (JSON değil)",
            bodyParse: req.body.data
        });
    } else {
        console.log(data[3]);
        const packet = nmea.parseNmeaSentence(data[3]);
        let location = "0,0";

        if (packet.sentenceId === "RMC" && packet.status === "valid") {
            location = `${packet.latitude},${packet.longitude}`;
        }

        if (packet.sentenceId === "GGA" && packet.fixType !== "none") {
            location = `${packet.latitude},${packet.longitude}`;
        }

        con.query(`INSERT INTO logs (id, vehicle, speed, voltage, battery, location, engine_temperature, battery_temperature, cells_temperature, date) VALUES (NULL, 'III', '${data[0]}', '${data[1]}', '${data[2]}', '${location}', '${data[4]}', '${data[5]}', '${data[6]}', '${date}');`, function (err, result, fields) {
            if (err)
                return res.send({
                    status: 128,
                    message: "Veriler işlenirken veritabanı cortladı (muhtemelen yanlış veri yollandı) (JSON değil)",
                    bodyParse: req.body
                });
        });

        res.send({
            status: 128,
            message: "Veriler işlendi (JSON)",
            bodyParse: req.body
        });
    }
});

app.post('/api/send/withjson', function (req, res) {
    const allowKeys = ["speed", "voltage", "battery", "location", "engine_temperature", "battery_temperature", "cells_temperature"];
    let controller = 0;

    Object.keys(req.body).forEach(key => {
        if (allowKeys.includes(key)) {
            controller++;
        }
    });

    if (controller === allowKeys.length) {
        // @ts-ignore
        const date = Math.floor(new Date() / 1000);

        con.query(`INSERT INTO logs (id, vehicle, speed, voltage, battery, location, engine_temperature, battery_temperature, cells_temperature, date) VALUES (NULL, 'III', '${req.body.speed}', '${req.body.voltage}', '${req.body.battery}', '${req.body.location}', '${req.body.engine_temperature}', '${req.body.battery_temperature}', '${req.body.cells_temperature}', '${date}');`, function (err, result, fields) {
            if (err)
                return res.send({
                    status: 128,
                    message: "Veriler işlenirken veritabanı cortladı (muhtemelen yanlış veri yollandı) (JSON)",
                    bodyParse: req.body
                });
        });

        res.send({
            status: 128,
            message: "Veriler işlendi (JSON)",
            bodyParse: req.body
        });
    } else {
        res.send({
            status: 256,
            message: "Eksik veri gönderildi (JSON)",
            bodyParse: req.body
        });
    }
});

app.listen(process.env.PORT);
