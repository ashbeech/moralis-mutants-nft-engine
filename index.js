// Foo is the variable I use, I won't tell you what it is.

// utilise Moralis
const Moralis = require("moralis/node");
// canvas for image compile
const { createCanvas, loadImage } = require("canvas");
// import config
const {
  layers,
  width,
  height,
  description,
  baseImageUri,
  editionSize,
  startEditionFrom,
  rarityWeights,
} = require("./input/config.js");
const console = require("console");
const fs = require("fs");
const request = require("request");
const { default: axios } = require("axios");
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

// Moralis creds
const appId = "WCQZUYeVgqeOnwmJt8Ba96aezPcc7zFbIZHUx8bN";
const serverUrl = "https://26nevk02p2iq.usemoralis.com:2053/server";
const masterKey = "3E6SbZaAYsTqtCoMLJkiILUuXmcUsTXR069h89Sy"; // DO NOT DISPLAY IN PUBLIC DIR
const xAPIKey = "xBi0kEi22STBYGD"; // DO NOT DISPLAY IN PUBLIC DIR
// xAPIKey available here: https://deep-index.moralis.io/api-docs/#/storage/uploadFolder
const api_url = "https://deep-index.moralis.io/api/v2/ipfs/uploadFolder";

Moralis.start({ serverUrl, appId, masterKey });

// adds a signature to the top left corner of the canvas for pre-production
const signImage = (_sig) => {
  ctx.fillStyle = "#000000";
  ctx.font = "bold 30pt Helvetica";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(_sig, 40, 40);
};

// generate a random color hue
const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, 85%)`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = genColor();
  ctx.fillRect(0, 0, width, height);
};

// add metadata for individual nft edition
const generateMetadata = (_dna, _edition, _attributesList, _path) => {
  let dateTime = Date.now();
  let tempMetadata = {
    dna: _dna.join(""),
    name: `#${_edition}`,
    description: description,
    image: _path || baseImageUri,
    edition: _edition,
    date: dateTime,
    attributes: _attributesList,
  };
  return tempMetadata;
};

// prepare attributes for the given element to be used as metadata
const getAttributeForElement = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  let attribute = {
    name: selectedElement.name,
    rarity: selectedElement.rarity,
  };
  return attribute;
};

// loads an image from the layer path
// returns the image in a format usable by canvas
const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    const image = await loadImage(`${_layer.selectedElement.path}`);
    resolve({ layer: _layer, loadedImage: image });
  });
};

const drawElement = (_element) => {
  ctx.drawImage(
    _element.loadedImage,
    _element.layer.position.x,
    _element.layer.position.y,
    _element.layer.size.width,
    _element.layer.size.height
  );
};

// check the configured layer to find information required for rendering the layer
// this maps the layer information to the generated dna and prepares it for
// drawing on a canvas
const constructLayerToDna = (_dna = [], _layers = [], _rarity) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElement = layer.elements.find(
      (element) => element.id === _dna[index]
    );
    return {
      location: layer.location,
      position: layer.position,
      size: layer.size,
      selectedElement: { ...selectedElement, rarity: _rarity },
    };
  });
  return mappedDnaToLayers;
};

// check if the given dna is contained within the given dnaList
// return true if it is, indicating that this dna is already in use and should be recalculated
const isDnaUnique = (_DnaList = [], _dna = []) => {
  let foundDna = _DnaList.find((i) => i.join("") === _dna.join(""));
  return foundDna == undefined ? true : false;
};

const getRandomRarity = (_rarityOptions) => {
  let randomPercent = Math.random() * 100;
  let percentCount = 0;

  for (let i = 0; i <= _rarityOptions.length; i++) {
    percentCount += _rarityOptions[i].percent;
    if (percentCount >= randomPercent) {
      console.log(`use random rarity ${_rarityOptions[i].id}`);
      return _rarityOptions[i].id;
    }
  }
  return _rarityOptions[0].id;
};

// create a dna based on the available layers for the given rarity
// use a random part for each layer
const createDna = (_layers, _rarity) => {
  let randNum = [];
  let _rarityWeight = rarityWeights.find((rw) => rw.value === _rarity);
  _layers.forEach((layer) => {
    let num = Math.floor(
      Math.random() * layer.elementIdsForRarity[_rarity].length
    );
    if (_rarityWeight && _rarityWeight.layerPercent[layer.id]) {
      // if there is a layerPercent defined, we want to identify which dna to actually use here (instead of only picking from the same rarity)
      let _rarityForLayer = getRandomRarity(
        _rarityWeight.layerPercent[layer.id]
      );
      num = Math.floor(
        Math.random() * layer.elementIdsForRarity[_rarityForLayer].length
      );
      randNum.push(layer.elementIdsForRarity[_rarityForLayer][num]);
    } else {
      randNum.push(layer.elementIdsForRarity[_rarity][num]);
    }
  });
  return randNum;
};

// holds which rarity should be used for which image in edition
let rarityForEdition;

// get the rarity for the image by edition number that should be generated
const getRarity = (_editionCount) => {
  if (!rarityForEdition) {
    // prepare array to iterate over
    rarityForEdition = [];
    rarityWeights.forEach((rarityWeight) => {
      for (let i = rarityWeight.from; i <= rarityWeight.to; i++) {
        rarityForEdition.push(rarityWeight.value);
      }
    });
  }
  return rarityForEdition[editionSize - _editionCount];
};

const writeMetaData = (_data) => {
  fs.writeFileSync("./output/_metadata.json", _data);
};

// holds which dna has already been used during generation
let dnaListByRarity = {};
// holds metadata for all NFTs
let metadataList = [];
// image data collection
const imageDataArray = [];
let image_CID = "";
let meta_CID = "";
let ipfsArray = [];
// array of promises so that only if finished, will next promise be initiated
let promiseArray = [];

const saveToServer = async (_meta_hash, _image_hash, foo) => {
  for (let i = foo; i < foo + 5; i++) {
    let id = i.toString();
    let paddedHex = (
      "0000000000000000000000000000000000000000000000000000000000000000" + id
    ).slice(-64);
    let url = `https://ipfs.moralis.io:2053/ipfs/${_meta_hash}/metadata/${paddedHex}.json`;
    let options = { json: true };
    request(url, options, (error, res, body) => {
      if (error) {
        return console.log(error);
      }

      if (!error && res.statusCode == 200) {
        // Save file reference to Moralis
        const FileDatabase = new Moralis.Object("Metadata");
        FileDatabase.set("edition", body.edition);
        FileDatabase.set("name", body.name);
        FileDatabase.set("dna", body.dna);
        FileDatabase.set("image", body.image);
        FileDatabase.set("attributes", body.attributes);
        FileDatabase.set("meta_hash", _meta_hash);
        FileDatabase.set("image_hash", _image_hash);
        FileDatabase.save();
      }
    });
  }
};

// upload metadata
const uploadMetadata = async (_cid, foo) => {
  let ipfsArray = [];
  let promiseArray = [];

  for (let i = foo; i < foo + 5; i++) {
    let id = i.toString();
    let paddedHex = (
      "0000000000000000000000000000000000000000000000000000000000000000" + id
    ).slice(-64);
    let filename = i.toString() + ".json";

    let filetype = "base64";
    imageDataArray[
      i
    ].filePath = `https://ipfs.moralis.io:2053/ipfs/${_cid}/images/${paddedHex}.png`;
    //imageDataArray[i].image_file = res.data[i].content;

    // do something else here after firstFunction completes
    let nftMetadata = generateMetadata(
      imageDataArray[i].newDna,
      imageDataArray[i].editionCount,
      imageDataArray[i].attributesList,
      imageDataArray[i].filePath
    );
    metadataList.push(nftMetadata);

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
  Promise.all(promiseArray).then(() => {
    axios
      .post(api_url, ipfsArray, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "X-API-Key": xAPIKey,
          "content-type": "application/json",
          accept: "application/json",
        },
      })
      .then((res) => {
        meta_CID = res.data[0].path.split("/")[4];
        console.log("META FILE PATHS:", res.data);
        saveToServer(meta_CID, image_CID, foo);
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

// Create generative art by using the canvas api
const startCreating = async () => {
  console.log("##################");
  console.log("# Generative Art #");
  console.log("# - Generating your NFT collection");
  console.log("##################");
  console.log();

  // clear meta data from previous run
  writeMetaData("");

  // prepare dnaList object
  rarityWeights.forEach((rarityWeight) => {
    dnaListByRarity[rarityWeight.value] = [];
  });

  // create NFTs from startEditionFrom to editionSize
  let editionCount = startEditionFrom;

  while (editionCount <= editionSize) {
    console.log("-----------------");
    console.log("Mutating %d of %d", editionCount, editionSize);

    // upload to ipfs
    const saveFile = async () => {
      // get rarity from to config to create NFT as
      let rarity = getRarity(editionCount);
      console.log("- rarity: " + rarity);

      // calculate the NFT dna by getting a random part for each layer/feature
      // based on the ones available for the given rarity to use during generation
      let newDna = createDna(layers, rarity);
      while (!isDnaUnique(dnaListByRarity[rarity], newDna)) {
        // recalculate dna as this has been used before.
        console.log(
          "found duplicate DNA " + newDna.join("-") + ", recalculate..."
        );
        newDna = createDna(layers, rarity);
      }
      console.log("- dna: " + newDna.join("-"));

      // propagate information about required layer contained within config into a mapping object
      // = prepare for drawing
      let results = constructLayerToDna(newDna, layers, rarity);
      let loadedElements = [];

      // load all images to be used by canvas
      results.forEach((layer) => {
        loadedElements.push(loadLayerImg(layer));
      });

      let attributesList = [];

      await Promise.all(loadedElements).then((elementArray) => {
        // create empty image
        ctx.clearRect(0, 0, width, height);
        // draw a random background color
        drawBackground();
        // store information about each layer to add it as meta information
        attributesList = [];
        // draw each layer
        elementArray.forEach((element) => {
          drawElement(element);
          attributesList.push(getAttributeForElement(element));
        });
        // add an image signature as the edition count to the top left of the image
        signImage(`#${editionCount}`);
        // write the image to the output directory
      });
      dnaListByRarity[rarity].push(newDna);

      const base64ImgData = canvas.toBuffer();
      const base64 = base64ImgData.toString("base64");

      let filename = editionCount.toString() + ".png";
      let filetype = "image/png";

      // save locally as file
      fs.writeFileSync(`./output/${filename}`, canvas.toBuffer(filetype));

      console.log(
        "Mutant " + editionCount.toString() + " a resident of Moralis"
      );

      imageDataArray[editionCount] = {
        editionCount: editionCount,
        newDna: newDna,
        attributesList: attributesList,
      };
    };

    const handleFinal = async () => {
      // write image  files
      const imageData = await saveFile();
    };

    await handleFinal();
    // iterate
    editionCount++;
  }
  // ipfsArray = [];
  // promiseArray = [];

  for (let foo = 1; foo <= editionSize; foo += 5) {
    let ipfsArray = [];
    let promiseArray = [];
    if (foo >= editionSize) break;

    for (let i = foo; i < foo + 5; i++) {
      let id = i.toString();
      let paddedHex = (
        "0000000000000000000000000000000000000000000000000000000000000000" + id
      ).slice(-64);

      console.log(id, "id");

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

    Promise.all(promiseArray).then(() => {
      axios
        .post(api_url, ipfsArray, {
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
          image_CID = res.data[0].path.split("/")[4];
          console.log("IMAGE CID:", image_CID);
          // pass folder CID to meta data
          uploadMetadata(image_CID, foo);
        })
        .catch((err) => {
          console.log(err);
        });
    });

    writeMetaData(JSON.stringify(metadataList));

    console.log("#########################################");
    console.log(
      "Welcome to Rekt City - Meet the Survivors",
      promiseArray.length,
      ipfsArray.length
    );
    console.log("#########################################");
    console.log();
  }
};

// Initiate code
startCreating();
