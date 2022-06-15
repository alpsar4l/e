const fs = require("fs");
const { stringify } = require("csv-stringify");
const filename = "saved_from_db.csv";
const writableStream = fs.createWriteStream(filename);


const mysql = require('mysql');
require('dotenv').config();

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

console.log("Finished writing data");
