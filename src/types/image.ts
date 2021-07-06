import Jimp from "jimp";
import Vibrant from "node-vibrant";
import { resolve } from "path";

import { collections } from "../database";
import { searchImages } from "../search/image";
import { unlinkAsync } from "../utils/fs/async";
import { generateHash } from "../utils/hash";
import { handleError, logger } from "../utils/logger";
import Actor from "./actor";
import ActorReference from "./actor_reference";
import { iterate } from "./common";
import Label from "./label";

export class ImageDimensions {
  width: number | null = null;
  height: number | null = null;
}

export class ImageMeta {
  size: number | null = null;
  dimensions = new ImageDimensions();
}

export default class Image {
  _id: string;
  name: string;
  path: string | null = null;
  thumbPath: string | null = null;
  scene: string | null = null;
  addedOn = +new Date();
  favorite = false;
  bookmark: number | null = null;
  rating = 0;
  customFields: Record<string, boolean | string | number | string[] | null> = {};
  meta = new ImageMeta();
  album?: string | null = null;
  studio: string | null = null;
  hash: string | null = null;
  color: string | null = null;

  static async iterate(
    func: (scene: Image) => void | unknown | Promise<void | unknown>,
    extraFilter: unknown[] = []
  ) {
    return iterate(searchImages, Image.getBulk, func, "image", extraFilter);
  }

  static async extractColor(image: Image): Promise<void> {
    if (!image.path) {
      return;
    }

    const palette = await Vibrant.from(image.path).getPalette();

    const color =
      palette.DarkVibrant?.getHex() ||
      palette.DarkMuted?.getHex() ||
      palette.Vibrant?.getHex() ||
      palette.Vibrant?.getHex();

    if (color) {
      image.color = color;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      collections.images.upsert(image._id, image).catch(() => {});
    }
  }

  static color(image: Image): string | null {
    if (!image.path) {
      return null;
    }
    if (image.color) {
      return image.color;
    }

    if (image.path) {
      logger.debug(`Extracting color from image "${image._id}"`);
      Image.extractColor(image).catch((err: Error) => {
        handleError(`Image color extraction failed for image "${image._id}" (${image.path})`, err);
      });
    }

    return null;
  }

  static async remove(image: Image): Promise<void> {
    await collections.images.remove(image._id);
    try {
      if (image.path) {
        await unlinkAsync(image.path);
      }
      if (image.thumbPath) {
        await unlinkAsync(image.thumbPath);
      }
    } catch (error) {
      handleError(`Could not delete source file for image ${image._id}`, error);
    }
  }

  /**
   * Removes the given studio from all images that
   * are associated to the studio
   *
   * @param studioId - id of the studio to remove
   */
  static async filterStudio(studioId: string): Promise<void> {
    await Image.iterateByStudio(studioId, async (image) => {
      image.studio = null;
      await collections.images.upsert(image._id, image);
    });
  }

  static async iterateByScene(
    sceneId: string,
    func: (scene: Image) => void | unknown | Promise<void | unknown>
  ): Promise<void | Image> {
    return Image.iterate(func, [
      {
        query_string: {
          query: `scene:${sceneId}`,
        },
      },
    ]);
  }

  static async getByScene(id: string): Promise<Image[]> {
    const { items } = await searchImages({}, "", [
      {
        query_string: {
          query: `scene:${id}`,
        },
      },
    ]);

    return Image.getBulk(items);
  }

  static async iterateByStudio(
    studioId: string,
    func: (scene: Image) => void | unknown | Promise<void | unknown>
  ): Promise<void | Image> {
    return Image.iterate(func, [
      {
        query_string: {
          query: `studio:${studioId}`,
        },
      },
    ]);
  }

  static async getById(_id: string): Promise<Image | null> {
    return collections.images.get(_id);
  }

  static getBulk(_ids: string[]): Promise<Image[]> {
    return collections.images.getBulk(_ids);
  }

  static async getAll(): Promise<Image[]> {
    return collections.images.getAll();
  }

  static async getActors(image: Image): Promise<Actor[]> {
    const references = await ActorReference.getByItem(image._id);
    return (await collections.actors.getBulk(references.map((r) => r.actor))).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  static async setActors(image: Image, actorIds: string[]): Promise<void> {
    return Actor.setForItem(image._id, actorIds, "image");
  }

  static async addActors(image: Image, actorIds: string[]): Promise<void> {
    return Actor.addForItem(image._id, actorIds, "image");
  }

  static async setLabels(image: Image, labelIds: string[]): Promise<void> {
    return Label.setForItem(image._id, labelIds, "image");
  }

  static async addLabels(image: Image, labelIds: string[]): Promise<void> {
    return Label.addForItem(image._id, labelIds, "image");
  }

  static async getLabels(image: Image): Promise<Label[]> {
    return Label.getForItem(image._id);
  }

  static async getByPath(path: string): Promise<Image | undefined> {
    const resolved = resolve(path);
    const images = await collections.images.query("path-index", encodeURIComponent(resolved));
    return images[0];
  }

  /**
   * @param image - the image to mutate
   * @param overwrite will read the image and apply the dimensions even if both dimensions already exist
   * @returns if added dimensions
   */
  static async addDimensions(image: Image, overwrite = false) {
    if (
      !image.path ||
      (!overwrite && image.meta.dimensions.height && image.meta.dimensions.width)
    ) {
      return false;
    }
    const jimpImage = await Jimp.read(image.path);
    image.meta.dimensions.width = jimpImage.bitmap.width;
    image.meta.dimensions.height = jimpImage.bitmap.height;
    return true;
  }

  constructor(name: string) {
    this._id = `im_${generateHash()}`;
    this.name = name.trim();
  }
}
