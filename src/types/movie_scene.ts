import { collections } from "../database";
import { generateHash } from "../utils/hash";

export default class MovieScene {
  _id: string;
  movie: string;
  scene: string;
  index?: number; // ? for backwards compatibility

  constructor(movie: string, scene: string) {
    this._id = `ms_${generateHash()}`;
    this.movie = movie;
    this.scene = scene;
  }

  static async getAll(): Promise<MovieScene[]> {
    return collections.movieScenes.getAll();
  }

  static async getByMovie(movie: string): Promise<MovieScene[]> {
    return (await collections.movieScenes.query("movie-index", movie)).sort(
      (a, b) => (a.index || -1) - (b.index || -1)
    );
  }

  static async getByScene(scene: string): Promise<MovieScene[]> {
    return collections.movieScenes.query("scene-index", scene);
  }

  static async get(from: string, to: string): Promise<MovieScene | undefined> {
    const fromReferences = await collections.movieScenes.query("movie-index", from);
    return fromReferences.find((r) => r.scene === to);
  }

  static async removeByScene(id: string): Promise<void> {
    for (const ref of await MovieScene.getByScene(id)) {
      await MovieScene.removeById(ref._id);
    }
  }

  static async removeByMovie(id: string): Promise<void> {
    for (const ref of await MovieScene.getByMovie(id)) {
      await MovieScene.removeById(ref._id);
    }
  }

  static async removeById(_id: string): Promise<void> {
    await collections.movieScenes.remove(_id);
  }
}
