const functions = require("firebase-functions");
const request = require("request-promise");
const admin = require("firebase-admin");
const UUID = require("uuid-v4");
const path = require("path");
const os = require("os");
const fs = require("fs");
const jpeg = require("jpeg-js");

// const lable = require('./target_classes');
// const tf = require('@tensorflow/tfjs-node');
// admin.initializeApp();

//load model

const tf = require("@tensorflow/tfjs");
const { tensor } = require("@tensorflow/tfjs");
const { count } = require("console");
// predict();

// async function getImage() {
//   var jpegData = await fs.readFileSync("corn.jpg");
//   var rawImageData = jpeg.decode(jpegData, true);
//   // console.log(rawImageData);
//   let tensor = await tf.browser
//     .fromPixels(rawImageData)
//     .cast("float32")
//     .resizeNearestNeighbor([224, 224]) // change the image size here
//     .expandDims()
//     .toFloat()
//     .reverse(-1);
//   // console.log("Input Image shape: ", tensor);
//   return tensor;
// }

////

const LINE_MESSAGING_API = "https://api.line.me/v2/bot";
const LINE_CONTENT_API = "https://api-data.line.me/v2/bot/message";
let CHANNEL_ACCESS_TOKEN =
  "tkYDvz+Nbimk0ZB3XBpqaeTWz+rnwV4f+zAubxnX5GKyJGK9ar6sLn9dE9kiuDoQUTm+B+im2Wx73HOxM/5TV1y6LooIosX3eTHAK340IQ9LKpN6OTWNNMUuUc1GR1TrcLrVoRASfjFzC6sRqcMdfQdB04t89/1O/w1cDnyilFU=";
const LINE_HEADER = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
};

exports.LineBot = functions.https.onRequest(async (req, res) => {
  console.log(req.body.events[0]);
  const event = req.body.events[0];
  if (event.message.type === "image") {
    // let urls = await upload(event);
    let url = `${LINE_CONTENT_API}/${event.message.id}/content`;
    let buffer = await request.get({
      headers: LINE_HEADER,
      uri: url,
      encoding: null, // กำหนดเป็น null เพื่อให้ได้ binary ที่สมบูรณ์
    });

    let filename = `${event.timestamp}.jpg`;
    let tempLocalFile = path.join("tmp", filename);
    await fs.writeFileSync(tempLocalFile, buffer);
    const pred = await predict(tempLocalFile);
    let classname = pred[0].className;
    let probability = pred[0].probability;
    probability = probability * 100;
    probability = probability.toFixed(2);
    console.log(probability);
    await reply(event.replyToken, {
      type: "text",
      text: `มีโอกาสเป็นโรค : ${classname} คิดเป็น ${probability} %`,
    });

    await fs.unlinkSync(tempLocalFile);
  }
});

const reply = (replyToken, payload) => {
  request.post({
    uri: `${LINE_MESSAGING_API}/message/reply`,
    headers: LINE_HEADER,
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [payload],
    }),
  });
};

// const upload = async (event) => {
//   // ดาวน์โหลด binary จาก LINE
//   const LINE_CONTENT_API = "https://api-data.line.me/v2/bot/message";
//   let url = `${LINE_CONTENT_API}/${event.message.id}/content`;
//   let buffer = await request.get({
//     headers: LINE_HEADER,
//     uri: url,
//     encoding: null, // กำหนดเป็น null เพื่อให้ได้ binary ที่สมบูรณ์
//   });

//   // สร้างไฟล์ temp ใน local โดยใช้ timestamp ที่ได้จาก webhook เป็นชื่อไฟล์
//   let filename = `${event.timestamp}.jpg`;
//   let tempLocalFile = path.join(os.tmpdir(), filename);
//   await fs.writeFileSync(tempLocalFile, buffer);

//   // generate ตัว uuid
//   let uuid = UUID();

//   // อัพโหลดไฟล์ขึ้น Cloud Storage
//   let bucket = admin.storage().bucket();
//   let file = await bucket.upload(tempLocalFile, {
//     // กำหนด path ในการเก็บไฟล์แยกเป็นแต่ละ userId
//     destination: `photos/${event.source.userId}/${filename}`,
//     metadata: {
//       cacheControl: "no-cache",
//       metadata: {
//         firebaseStorageDownloadTokens: uuid,
//       },
//     },
//   });

//   // ลบไฟล์ temp เมื่ออัพโหลดเรียบร้อย
//   fs.unlinkSync(tempLocalFile);

//   // วิธีลัดในการสร้าง download url ขึ้นมา
//   let prefix = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o`;
//   let suffix = `alt=media&token=${uuid}`;
//   return `${prefix}/${encodeURIComponent(file[0].name)}?${suffix}`;
// };

async function predict(jpg) {
  var label = ["Blight", "gray spot", "Healthy", "Rust"];
  let model = await tf.loadGraphModel(
    "https://raw.githubusercontent.com/stang464/lineBotCorn/main/model/model.json"
  );
  // model.summary();
  await console.log("model is loaded.!!!!");
  var jpegData = await fs.readFileSync(jpg);
  var rawImageData = jpeg.decode(jpegData, { useTArray: true });
  let tensor = await tf.browser
    .fromPixels(rawImageData)
    .cast("float32")
    .resizeNearestNeighbor([224, 224]) // change the image size here
    .expandDims()
    .toFloat()
    .reverse(-1);
  const predictions = await model.predict(tensor).data();
  console.log(predictions);
  let top5 = Array.from(predictions)
    .map(function (p, i) {
      // this is Array.map
      return {
        probability: p,
        className: label[i], // we are selecting the value from the obj
      };
    })
    .sort(function (a, b) {
      return b.probability - a.probability;
    })
    .slice(0, 5);

  console.log(top5);
  return top5;
}
