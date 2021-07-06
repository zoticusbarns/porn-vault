import Jimp from "jimp";

import { collections } from "../../database";
import { FFProbeContainers } from "../../ffmpeg/ffprobe";
import { CopyMP4Transcoder } from "../../transcode/copyMp4";
import { SceneStreamTypes } from "../../transcode/transcoder";
import Actor from "../../types/actor";
import CustomField, { CustomFieldTarget } from "../../types/custom_field";
import Image from "../../types/image";
import Label from "../../types/label";
import Marker from "../../types/marker";
import Movie from "../../types/movie";
import Scene from "../../types/scene";
import Studio from "../../types/studio";
import SceneView from "../../types/watch";
import { handleError, logger } from "../../utils/logger";
import { getExtension } from "../../utils/string";

interface AvailableStreams {
  label: string;
  mimeType?: string;
  streamType: SceneStreamTypes;
  transcode: boolean;
}

export default {
  async actors(scene: Scene): Promise<Actor[]> {
    const actors = await Scene.getActors(scene);
    return actors.sort((a, b) => a.name.localeCompare(b.name));
  },
  async images(scene: Scene): Promise<Image[]> {
    return await Image.getByScene(scene._id);
  },
  async labels(scene: Scene): Promise<Label[]> {
    const labels = await Scene.getLabels(scene);
    return labels.sort((a, b) => a.name.localeCompare(b.name));
  },
  async thumbnail(scene: Scene): Promise<Image | null> {
    if (scene.thumbnail) return await Image.getById(scene.thumbnail);
    return null;
  },
  async preview(scene: Scene): Promise<Image | null> {
    if (!scene.preview) {
      return null;
    }
    const image = await Image.getById(scene.preview);
    if (!image) {
      return null;
    }

    // Pre 0.27 compatibility: add image dimensions on demand and save to db
    if (image.path && (!image.meta.dimensions.height || !image.meta.dimensions.width)) {
      const jimpImage = await Jimp.read(image.path);
      image.meta.dimensions.width = jimpImage.bitmap.width;
      image.meta.dimensions.height = jimpImage.bitmap.height;

      await collections.images.upsert(image._id, image);
    }

    return image;
  },
  async studio(scene: Scene): Promise<Studio | null> {
    if (scene.studio) return Studio.getById(scene.studio);
    return null;
  },
  async markers(scene: Scene): Promise<Marker[]> {
    return await Scene.getMarkers(scene);
  },
  async availableFields(): Promise<CustomField[]> {
    const fields = await CustomField.getAll();
    return fields.filter((field) => field.target.includes(CustomFieldTarget.SCENES));
  },
  async movies(scene: Scene): Promise<Movie[]> {
    return Scene.getMovies(scene);
  },
  async watches(scene: Scene): Promise<number[]> {
    return (await SceneView.getByScene(scene._id)).map((v) => v.date);
  },
  async availableStreams(scene: Scene): Promise<AvailableStreams[]> {
    if (!scene.path) {
      return [];
    }

    if (!scene.meta.container || !scene.meta.videoCodec) {
      logger.verbose(
        `Scene ${scene._id} doesn't have codec information to determine available streams, running ffprobe`
      );
      await Scene.runFFProbe(scene);

      // Doesn't matter if this fails
      await collections.scenes.upsert(scene._id, scene).catch((err) => {
        handleError("Failed to update scene after updating codec information", err);
      });
    }

    const streams: AvailableStreams[] = [];

    // Attempt direct stream, set it as first item
    streams.unshift({
      label: "direct play",
      mimeType:
        // Attempt to trick the browser into playing mkv by using the mp4 mime type
        // Otherwise let the browser handle the unknown mime type
        [".mp4", ".mkv"].includes(getExtension(scene.path)) ? "video/mp4" : undefined,
      streamType: SceneStreamTypes.DIRECT,
      transcode: false,
    });

    // Mkv might contain mp4 compatible streams
    if (
      scene.meta.container === FFProbeContainers.MKV &&
      scene.meta.videoCodec &&
      new CopyMP4Transcoder(scene).isVideoValidForContainer()
    ) {
      streams.push({
        label: "mkv direct stream",
        mimeType: "video/mp4",
        streamType: SceneStreamTypes.MP4_DIRECT,
        transcode: true,
      });
    }

    // Fallback transcode: mp4 (potentially hardware accelerated)
    streams.push({
      label: "mp4 transcode",
      mimeType: "video/mp4",
      streamType: SceneStreamTypes.MP4_TRANSCODE,
      transcode: true,
    });

    // Fallback transcode: webm
    streams.push({
      label: "webm transcode",
      mimeType: "video/webm",
      streamType: SceneStreamTypes.WEBM_TRANSCODE,
      transcode: true,
    });

    // Otherwise video cannot be streamed

    return streams;
  },
};
