const fs = require("fs");
const Moralis = require("moralis/node");
const { default: axios } = require("axios");
const { saveToDb } = require("./filesystem");

const { description, baseImageUri } = require("../input/config.js");

// write metadata locally to json files
const writeMetaData = (metadataList) => {
  fs.writeFileSync("./output/_metadata.json", JSON.stringify(metadataList));
};

// add metadata for individual nft edition
const generateMetadata = (dna, edition, attributesList, path) => {
  let dateTime = Date.now();
  let tempMetadata = {
    dna: dna.join(""),
    name: `#${edition}`,
    description: description,
    image: path || baseImageUri,
    edition: edition,
    date: dateTime,
    attributes: attributesList,
  };
  return tempMetadata;
};

// upload metadata
const uploadMetadata = async (
  apiUrl,
  xAPIKey,
  imageCID,
  editionSize,
  imageDataArray
) => {
  const ipfsArray = []; // holds all IPFS data
  const metadataList = []; // holds metadata for all NFTs (could be a session store of data)
  const promiseArray = []; // array of promises so that only if finished, will next promise be initiated

  for (let i = 1; i < editionSize + 1; i++) {
    let id = i.toString();
    let paddedHex = (
      "0000000000000000000000000000000000000000000000000000000000000000" + id
    ).slice(-64);
    let filename = i.toString() + ".json";

    let filetype = "base64";
    imageDataArray[
      i
    ].filePath = `https://ipfs.moralis.io:2053/ipfs/${imageCID}/images/${paddedHex}.png`;
    //imageDataArray[i].image_file = res.data[i].content;

    // do something else here after firstFunction completes
    let nftMetadata = generateMetadata(
      imageDataArray[i].newDna,
      imageDataArray[i].editionCount,
      imageDataArray[i].attributesList,
      imageDataArray[i].filePath
    );
    metadataList.push(nftMetadata);

    // upload metafile data to Moralis
    const metaFile = new Moralis.File(filename, {
      base64: Buffer.from(
        JSON.stringify(metadataList.find((meta) => meta.edition == i))
      ).toString("base64"),
    });

    // save locally as file
    fs.writeFileSync(
      `./output/${filename}`,
      JSON.stringify(metadataList.find((meta) => meta.edition == i))
    );

    // reads output folder for json files and then adds to IPFS object array
    promiseArray.push(
      new Promise((res, rej) => {
        fs.readFile(`./output/${id}.json`, (err, data) => {
          if (err) rej();
          ipfsArray.push({
            path: `metadata/${paddedHex}.json`,
            content: data.toString("base64"),
          });
          res();
        });
      })
    );
  }

  // once all promises back then save to IPFS and Moralis database
  Promise.all(promiseArray).then(() => {
    axios
      .post(apiUrl, ipfsArray, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "X-API-Key": xAPIKey,
          "content-type": "application/json",
          accept: "application/json",
        },
      })
      .then((res) => {
        let metaCID = res.data[0].path.split("/")[4];
        console.log("META FILE PATHS:", res.data);
        saveToDb(metaCID, imageCID, editionSize);
        writeMetaData(metadataList);
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

// compile metadata (reads output folder images)
const compileMetadata = async (
  apiUrl,
  xAPIKey,
  editionCount,
  editionSize,
  imageDataArray
) => {
  ipfsArray = [];
  promiseArray = [];

  for (let i = 1; i < editionCount; i++) {
    let id = i.toString();
    let paddedHex = (
      "0000000000000000000000000000000000000000000000000000000000000000" + id
    ).slice(-64);

    // reads output folder for images and adds to IPFS object metadata array (within promise array)
    promiseArray.push(
      new Promise((res, rej) => {
        fs.readFile(`./output/${id}.png`, (err, data) => {
          if (err) rej();
          ipfsArray.push({
            path: `images/${paddedHex}.png`,
            content: data.toString("base64"),
          });
          res();
        });
      })
    );
  }

  // once all promises then upload IPFS object metadata array
  Promise.all(promiseArray).then(() => {
    axios
      .post(apiUrl, ipfsArray, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "X-API-Key": xAPIKey,
          "content-type": "application/json",
          accept: "application/json",
        },
      })
      .then((res) => {
        console.log("IMAGE FILE PATHS:", res.data);
        let imageCID = res.data[0].path.split("/")[4];
        console.log("IMAGE CID:", imageCID);
        // pass folder CID to meta data
        uploadMetadata(apiUrl, xAPIKey, imageCID, editionSize, imageDataArray);
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

module.exports = {
  generateMetadata,
  writeMetaData,
  uploadMetadata,
  compileMetadata,
};
