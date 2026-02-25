export function makeButton(label, width = 220, height = 56, color = 0x10233f) {
  const root = new PIXI.Container();
  const bg = new PIXI.Graphics().roundRect(0, 0, width, height, 14).fill(color);
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xffffff,
      fontFamily: 'Trebuchet MS',
      fontSize: 24,
      fontWeight: '700'
    }
  });
  text.anchor.set(0.5);
  text.x = width / 2;
  text.y = height / 2;

  root.eventMode = 'static';
  root.cursor = 'pointer';
  root.addChild(bg, text);
  root._label = text;

  root.on('pointerover', () => {
    bg.tint = 0xe8f0ff;
    text.style.fill = 0x10233f;
  });
  root.on('pointerout', () => {
    bg.tint = 0xffffff;
    text.style.fill = 0xffffff;
  });

  return root;
}

export function setButtonText(button, nextLabel) {
  if (button?._label) {
    button._label.text = nextLabel;
  }
}