const { loadImage } = require("canvas");

// adds a signature to the top left corner of the canvas for pre-production
const signImage = (ctx, sig) => {
  ctx.fillStyle = "#000000";
  ctx.font = "bold 30pt Helvetica";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(sig, 40, 40);
};

// generate a random color hue
const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, 85%)`;
  return pastel;
};

const drawBackground = (ctx, width, height) => {
  ctx.fillStyle = genColor();
  ctx.fillRect(0, 0, width, height);
};

// loads an image from the layer path
// returns the image in a format usable by canvas
const loadLayerImg = async layer => {
  return new Promise(async resolve => {
    const image = await loadImage(`${layer.selectedElement.path}`);
    resolve({ layer: layer, loadedImage: image });
  });
};

const drawElement = (ctx, element) => {
  ctx.drawImage(
    element.loadedImage,
    element.layer.position.x,
    element.layer.position.y,
    element.layer.size.width,
    element.layer.size.height
  );
};

module.exports = {
  signImage,
  genColor,
  drawBackground,
  loadLayerImg,
  drawElement
};
