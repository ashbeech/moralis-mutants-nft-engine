const fs = require("fs");
const Moralis = require("moralis/node");
const request = require("request");

// import canvas
const {
  signImage,
  drawBackground,
  loadLayerImg,
  drawElement
} = require("./canvas");

// import dna
const { constructLayerToDna, isDnaUnique, createDna } = require("./dna");

// import rarity
const { createDnaListByRarity, getRarity } = require("./rarity");

// create files and return image object array
const createFile = async (
  canvas,
  ctx,
  layers,
  width,
  height,
  editionCount,
  editionSize,
  rarityWeights,
  imageDataArray
) => {
  // holds which dna has already been used during generation and prepares dnaList object
  const dnaListByRarity = createDnaListByRarity(rarityWeights);

  // get rarity from to config to create NFT as
  let rarity = getRarity(editionCount, editionSize);
  console.log("- rarity: " + rarity);

  // calculate the NFT dna by getting a random part for each layer/feature
  // based on the ones available for the given rarity to use during generation
  let newDna = createDna(layers, rarity, rarityWeights);
  while (!isDnaUnique(dnaListByRarity[rarity], newDna)) {
    // recalculate dna as this has been used before.
    console.log("found duplicate DNA " + newDna.join("-") + ", recalculate...");
    newDna = createDna(layers, rarity, rarityWeights);
  }
  console.log("- dna: " + newDna.join("-"));

  // propagate information about required layer contained within config into a mapping object
  // = prepare for drawing
  let results = constructLayerToDna(newDna, layers, rarity);
  let loadedElements = [];

  // load all images to be used by canvas
  results.forEach(layer => {
    loadedElements.push(loadLayerImg(layer));
  });

  let attributesList = [];

  await Promise.all(loadedElements).then(elementArray => {
    // create empty image
    ctx.clearRect(0, 0, width, height);
    // draw a random background color
    drawBackground(ctx, width, height);
    // store information about each layer to add it as meta information
    attributesList = [];
    // draw each layer
    elementArray.forEach(element => {
      drawElement(ctx, element);
      let selectedElement = element.layer.selectedElement;
      attributesList.push({
        name: selectedElement.name,
        rarity: selectedElement.rarity
      });
    });
    // add an image signature as the edition count to the top left of the image
    signImage(ctx, `#${editionCount}`);
    // write the image to the output directory
  });

  dnaListByRarity[rarity].push(newDna);

  const base64ImgData = canvas.toBuffer();
  const base64 = base64ImgData.toString("base64");

  let filename = editionCount.toString() + ".png";
  let filetype = "image/png";

  // save locally as file
  fs.writeFileSync(`./output/${filename}`, canvas.toBuffer(filetype));

  console.log(`Created #${editionCount.toString()}`);

  imageDataArray[editionCount] = {
    editionCount: editionCount,
    newDna: newDna,
    attributesList: attributesList
  };

  return imageDataArray;
};

// upload to ipfs
const saveToIPFS = async (metaHash, imageHash, editionSize) => {
  for (let i = 1; i < editionSize + 1; i++) {
    let id = i.toString();
    let paddedHex = (
      "0000000000000000000000000000000000000000000000000000000000000000" + id
    ).slice(-64);
    let url = `https://ipfs.moralis.io:2053/ipfs/${metaHash}/metadata/${paddedHex}.json`;
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
        FileDatabase.set("meta_hash", metaHash);
        FileDatabase.set("image_hash", imageHash);
        FileDatabase.save();
      }
    });
  }
};

module.exports = {
  createFile,
  saveToIPFS
};
