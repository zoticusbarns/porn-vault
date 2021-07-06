import { expect } from "chai";

import Scene from "../../src/types/scene";
import { indexScenes, searchScenes } from "../../src/search/scene";
import { startTestServer, stopTestServer } from "../testServer";
import { collections } from "../../src/database";

describe("Search", () => {
  describe("Scene", () => {
    const scene = new Scene("Ginebra Bellucci - Outdoor Anal Action");

    before(async function () {
      await startTestServer.call(this);

      expect(await Scene.getAll()).to.be.empty;
      await collections.scenes.upsert(scene._id, scene);
      await indexScenes([scene]);
      expect(await Scene.getAll()).to.have.lengthOf(1);
    });

    after(() => {
      stopTestServer();
    });

    it("Should find scene by name", async function () {
      const searchResult = await searchScenes({
        query: "ginebra",
      });
      expect(searchResult).to.deep.equal({
        items: [scene._id],
        total: 1,
        numPages: 1,
      });
    });

    it("Should not find scene with bad query", async function () {
      const searchResult = await searchScenes({
        query: "asdva35aeb5se5b",
      });
      expect(searchResult).to.deep.equal({
        items: [],
        total: 0,
        numPages: 0,
      });
    });

    it("Should find scene with 1 typo", async function () {
      const searchResult = await searchScenes({
        query: "Belucci",
      });
      expect(searchResult).to.deep.equal({
        items: [scene._id],
        total: 1,
        numPages: 1,
      });
    });

    it("Should find scene by name with underscores", async function () {
      stopTestServer();
      await startTestServer.call(this);

      expect(await Scene.getAll()).to.be.empty;
      const scene = new Scene("Ginebra_Bellucci - Outdoor Anal Action");
      await collections.scenes.upsert(scene._id, scene);
      await indexScenes([scene]);
      expect(await Scene.getAll()).to.have.lengthOf(1);

      const searchResult = await searchScenes({
        query: "ginebra",
      });
      expect(searchResult).to.deep.equal({
        items: [scene._id],
        total: 1,
        numPages: 1,
      });
    });
  });
});
