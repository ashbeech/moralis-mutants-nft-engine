const fs = require("fs");
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
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

// Moralis creds
const appId = "YOUR_MORALIS_APP_ID";
const serverUrl = "YOUR_MORALIS_SERVER_URL";
const masterKey = "YOUR_MORALIS_MASTER_KEY"; // DO NOT DISPLAY IN PUBLIC DIR

Moralis.start({ serverUrl, appId, masterKey });

// adds a signature to the top left corner of the canvas
const signImage = (_sig) => {
  ctx.fillStyle = "#000000";
  ctx.font = "bold 30pt Courier";
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
let filePath = null;
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
    const saveFileIPFS = async () => {
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

      // save to hosted IPFS file
      const file = new Moralis.File(filename, { base64: base64 });
      const fileIpfs = await file.saveIPFS({ useMasterKey: true });

      const filePath = file.ipfs();
      const fileHash = file.hash();

      const metadata = {
        name: filename,
        nftFilePath: filePath,
        nftFileHash: fileHash,
      };

      console.log("Metadata: ", metadata);
      console.log("File Path: ", filePath);
      console.log(
        "Mutant " + editionCount.toString() + " a resident of Moralis"
      );

      const data = {
        editionCount: editionCount,
        filePath: filePath,
        fileHash: fileHash,
        newDna: newDna,
        attributesList: attributesList,
        file: file,
      };

      return data;
    };

    // upload metadata
    const uploadMetadata = async (_params) => {
      // do something else here after firstFunction completes
      let nftMetadata = generateMetadata(
        _params.newDna,
        _params.editionCount,
        _params.attributesList,
        _params.filePath
      );
      metadataList.push(nftMetadata);

      const metaFile = new Moralis.File(editionCount.toString() + ".json", {
        base64: Buffer.from(
          JSON.stringify(
            metadataList.find((meta) => meta.edition == _params.editionCount)
          )
        ).toString("base64"),
      });

      // save locally as file
      fs.writeFileSync(
        `./output/${editionCount}.json`,
        JSON.stringify(
          metadataList.find((meta) => meta.edition == editionCount)
        )
      );
      // save to hosted IPFS file
      let _metaFile = await metaFile.saveIPFS({ useMasterKey: true });

      // Save file reference to Moralis
      const FileDatabase = new Moralis.Object("Files");
      FileDatabase.set("name", _params.editionCount.toString());
      FileDatabase.set("path", _params.filePath);
      FileDatabase.set("hash", _params.filePath);
      FileDatabase.set("imagefile", _params.file);
      FileDatabase.set("metafile", metaFile);
      await FileDatabase.save();
    };

    const handleFinal = async () => {
      const image = await saveFileIPFS();
      await uploadMetadata(image);
    };

    await handleFinal();
    // iterate
    editionCount++;
  }
  writeMetaData(JSON.stringify(metadataList));
  console.log("#########################################");
  console.log("Welcome to Rekt City - Meet the Survivors");
  console.log("#########################################");
  console.log();
};

// Initiate code
startCreating();
