// Production-only Phaser entry (vite.config.ts aliases `phaser` here for
// `vite build`; dev keeps the stock bundle). Mirrors phaser/src/phaser.js but
// drops the namespaces Aetherfall never touches: Physics (Arcade + Matter),
// Tilemaps, Sound (music/sfx are our own WebAudio), the Camera3D/FBInstant
// plugins and the game objects we never create (see GameObjects below).
// Everything else stays so `Phaser.*` lookups in game code keep
// working. If you start using one of the dropped namespaces, add it back here
// (and flip FEATURE_SOUND in vite.config.ts for Phaser's sound manager).
import 'phaser/src/polyfills/requestVideoFrame.js';
import CONST from 'phaser/src/const.js';
import Extend from 'phaser/src/utils/object/Extend.js';

import Actions from 'phaser/src/actions/index.js';
import Animations from 'phaser/src/animations/index.js';
import BlendModes from 'phaser/src/renderer/BlendModes.js';
import Cache from 'phaser/src/cache/index.js';
import Cameras from 'phaser/src/cameras/index.js';
import Core from 'phaser/src/core/index.js';
import Class from 'phaser/src/utils/Class.js';
import Create from 'phaser/src/create/index.js';
import Curves from 'phaser/src/curves/index.js';
import Data from 'phaser/src/data/index.js';
import Display from 'phaser/src/display/index.js';
import DOM from 'phaser/src/dom/index.js';
import Events from 'phaser/src/events/index.js';
import FX from 'phaser/src/fx/index.js';
import Game from 'phaser/src/core/Game.js';
import GOEvents from 'phaser/src/gameobjects/events/index.js';
import DisplayList from 'phaser/src/gameobjects/DisplayList.js';
import GameObjectCreator from 'phaser/src/gameobjects/GameObjectCreator.js';
import GameObjectFactory from 'phaser/src/gameobjects/GameObjectFactory.js';
import UpdateList from 'phaser/src/gameobjects/UpdateList.js';
import Components from 'phaser/src/gameobjects/components/index.js';
import GetCalcMatrix from 'phaser/src/gameobjects/GetCalcMatrix.js';
import BuildGameObject from 'phaser/src/gameobjects/BuildGameObject.js';
import BuildGameObjectAnimation from 'phaser/src/gameobjects/BuildGameObjectAnimation.js';
import GameObject from 'phaser/src/gameobjects/GameObject.js';
import Container from 'phaser/src/gameobjects/container/Container.js';
import Graphics from 'phaser/src/gameobjects/graphics/Graphics.js';
import Group from 'phaser/src/gameobjects/group/Group.js';
import Image from 'phaser/src/gameobjects/image/Image.js';
import Layer from 'phaser/src/gameobjects/layer/Layer.js';
import Sprite from 'phaser/src/gameobjects/sprite/Sprite.js';
import Text from 'phaser/src/gameobjects/text/Text.js';
import GetTextSize from 'phaser/src/gameobjects/text/GetTextSize.js';
import MeasureText from 'phaser/src/gameobjects/text/MeasureText.js';
import TextStyle from 'phaser/src/gameobjects/text/TextStyle.js';
import Zone from 'phaser/src/gameobjects/zone/Zone.js';
import Shape from 'phaser/src/gameobjects/shape/Shape.js';
import Arc from 'phaser/src/gameobjects/shape/arc/Arc.js';
import Ellipse from 'phaser/src/gameobjects/shape/ellipse/Ellipse.js';
import Rectangle from 'phaser/src/gameobjects/shape/rectangle/Rectangle.js';
import Light from 'phaser/src/gameobjects/lights/Light.js';
import LightsManager from 'phaser/src/gameobjects/lights/LightsManager.js';
import LightsPlugin from 'phaser/src/gameobjects/lights/LightsPlugin.js';
// Factories/creators register `this.add.*` / `this.make.*` as a side effect.
import ContainerFactory from 'phaser/src/gameobjects/container/ContainerFactory.js';
import GraphicsFactory from 'phaser/src/gameobjects/graphics/GraphicsFactory.js';
import GroupFactory from 'phaser/src/gameobjects/group/GroupFactory.js';
import ImageFactory from 'phaser/src/gameobjects/image/ImageFactory.js';
import LayerFactory from 'phaser/src/gameobjects/layer/LayerFactory.js';
import SpriteFactory from 'phaser/src/gameobjects/sprite/SpriteFactory.js';
import TextFactory from 'phaser/src/gameobjects/text/TextFactory.js';
import ZoneFactory from 'phaser/src/gameobjects/zone/ZoneFactory.js';
import ArcFactory from 'phaser/src/gameobjects/shape/arc/ArcFactory.js';
import EllipseFactory from 'phaser/src/gameobjects/shape/ellipse/EllipseFactory.js';
import RectangleFactory from 'phaser/src/gameobjects/shape/rectangle/RectangleFactory.js';
import ContainerCreator from 'phaser/src/gameobjects/container/ContainerCreator.js';
import GraphicsCreator from 'phaser/src/gameobjects/graphics/GraphicsCreator.js';
import GroupCreator from 'phaser/src/gameobjects/group/GroupCreator.js';
import ImageCreator from 'phaser/src/gameobjects/image/ImageCreator.js';
import LayerCreator from 'phaser/src/gameobjects/layer/LayerCreator.js';
import SpriteCreator from 'phaser/src/gameobjects/sprite/SpriteCreator.js';
import TextCreator from 'phaser/src/gameobjects/text/TextCreator.js';
import ZoneCreator from 'phaser/src/gameobjects/zone/ZoneCreator.js';
import Geom from 'phaser/src/geom/index.js';
import Input from 'phaser/src/input/index.js';
import Loader from 'phaser/src/loader/index.js';
import PMath from 'phaser/src/math/index.js';
import Plugins from 'phaser/src/plugins/index.js';
import Renderer from 'phaser/src/renderer/index.js';
import Scale from 'phaser/src/scale/index.js';
import ScaleModes from 'phaser/src/renderer/ScaleModes.js';
import Scene from 'phaser/src/scene/Scene.js';
import Scenes from 'phaser/src/scene/index.js';
import Structs from 'phaser/src/structs/index.js';
import Textures from 'phaser/src/textures/index.js';
import Time from 'phaser/src/time/index.js';
import Tweens from 'phaser/src/tweens/index.js';
import Utils from 'phaser/src/utils/index.js';

// Only the game objects Aetherfall creates (text, image, container, graphics,
// rectangle/circle/ellipse shapes) plus the cheap internals other Phaser
// systems lean on. Particles, BitmapText, Mesh, Video, NineSlice, Rope,
// RenderTexture etc. are left out — add the class + its factory to use one.
const GameObjects = {
  Events: GOEvents, DisplayList, GameObjectCreator, GameObjectFactory, UpdateList,
  Components, GetCalcMatrix, BuildGameObject, BuildGameObjectAnimation, GameObject,
  Container, Graphics, Group, Image, Layer, Sprite, Text, GetTextSize, MeasureText,
  TextStyle, Zone, Shape, Arc, Ellipse, Rectangle, Light, LightsManager, LightsPlugin,
  Factories: {
    Container: ContainerFactory, Graphics: GraphicsFactory, Group: GroupFactory,
    Image: ImageFactory, Layer: LayerFactory, Sprite: SpriteFactory, Text: TextFactory,
    Zone: ZoneFactory, Arc: ArcFactory, Ellipse: EllipseFactory, Rectangle: RectangleFactory,
  },
  Creators: {
    Container: ContainerCreator, Graphics: GraphicsCreator, Group: GroupCreator,
    Image: ImageCreator, Layer: LayerCreator, Sprite: SpriteCreator, Text: TextCreator,
    Zone: ZoneCreator,
  },
};

const Phaser = Extend(false, {
  Actions, Animations, BlendModes, Cache, Cameras, Core, Class, Create, Curves,
  Data, Display, DOM, Events, FX, Game, GameObjects, Geom, Input, Loader,
  Math: PMath, Plugins, Renderer, Scale, ScaleModes, Scene, Scenes, Structs,
  Textures, Time, Tweens, Utils,
}, CONST);

globalThis.Phaser = Phaser;

export default Phaser;
