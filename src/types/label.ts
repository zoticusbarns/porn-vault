import { collections } from "../database";
import { generateHash } from "../utils/hash";
import { logger } from "../utils/logger";
import { arrayDiff } from "../utils/misc";
import LabelledItem from "./labelled_item";

export default class Label {
  _id: string;
  name: string;
  aliases: string[] = [];
  addedOn = +new Date();
  thumbnail: string | null = null;
  color?: string | null;

  static async remove(_id: string): Promise<void> {
    await collections.labels.remove(_id);
  }

  static async setForItem(itemId: string, labelIds: string[], type: string): Promise<void> {
    const oldRefs = await LabelledItem.getByItem(itemId);

    const { removed, added } = arrayDiff(oldRefs, [...new Set(labelIds)], "label", (l) => l);

    for (const oldRef of removed) {
      await collections.labelledItems.remove(oldRef._id);
    }

    for (const id of added) {
      const labelledItem = new LabelledItem(itemId, id, type);
      logger.debug(`Adding label: ${JSON.stringify(labelledItem)}`);
      await collections.labelledItems.upsert(labelledItem._id, labelledItem);
    }
  }

  static async addForItem(itemId: string, labelIds: string[], type: string): Promise<void> {
    const oldRefs = await LabelledItem.getByItem(itemId);

    const { added } = arrayDiff(oldRefs, [...new Set(labelIds)], "label", (l) => l);

    for (const id of added) {
      const labelledItem = new LabelledItem(itemId, id, type);
      logger.debug(`Adding label: ${JSON.stringify(labelledItem)}`);
      await collections.labelledItems.upsert(labelledItem._id, labelledItem);
    }
  }

  static async getForItem(id: string): Promise<Label[]> {
    const references = await LabelledItem.getByItem(id);
    return await Label.getBulk(references.map((r) => r.label));
  }

  static async getById(_id: string): Promise<Label | null> {
    return collections.labels.get(_id);
  }

  static getBulk(_ids: string[]): Promise<Label[]> {
    return collections.labels.getBulk(_ids);
  }

  static async getAll(): Promise<Label[]> {
    return collections.labels.getAll();
  }

  static async find(name: string): Promise<Label | undefined> {
    name = name.toLowerCase().trim();
    const allLabels = await Label.getAll();
    return allLabels.find((label) => label.name === name);
  }

  constructor(name: string, aliases: string[] = []) {
    this._id = `la_${generateHash()}`;
    this.name = name.trim();
    this.aliases = [...new Set(aliases.map((alias) => alias.toLowerCase().trim()))];
  }
}
