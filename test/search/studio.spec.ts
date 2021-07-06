import { expect } from "chai";

import Studio from "../../src/types/studio";
import { indexStudios, searchStudios } from "../../src/search/studio";
import { startTestServer, stopTestServer } from "../testServer";
import { collections } from "../../src/database";

describe("Search", () => {
  describe("Studio", () => {
    const studio = new Studio("Porn Fidelity");

    before(async function () {
      await startTestServer.call(this);

      expect(await Studio.getAll()).to.be.empty;
      await collections.studios.upsert(studio._id, studio);
      await indexStudios([studio]);
      expect(await Studio.getAll()).to.have.lengthOf(1);
    });

    after(() => {
      stopTestServer();
    });

    it("Should find studio by name", async function () {
      const searchResult = await searchStudios({
        query: "fidelity",
      });
      expect(searchResult).to.deep.equal({
        items: [studio._id],
        total: 1,
        numPages: 1,
      });
    });

    it("Should not find studio with bad query", async function () {
      const searchResult = await searchStudios({
        query: "asdva35aeb5se5b",
      });
      expect(searchResult).to.deep.equal({
        items: [],
        total: 0,
        numPages: 0,
      });
    });

    it("Should find studio with 1 typo", async function () {
      const searchResult = await searchStudios({
        query: "fidelty",
      });
      expect(searchResult).to.deep.equal({
        items: [studio._id],
        total: 1,
        numPages: 1,
      });
    });

    it("Should find studio (typeahead)", async function () {
      const searchResult = await searchStudios({
        query: "p",
      });
      expect(searchResult).to.deep.equal({
        items: [studio._id],
        total: 1,
        numPages: 1,
      });
    });

    it("Should find studio by name with underscores", async function () {
      stopTestServer();
      await startTestServer.call(this);

      expect(await Studio.getAll()).to.be.empty;
      const studio = new Studio("Porn_Fidelity");
      await collections.studios.upsert(studio._id, studio);
      await indexStudios([studio]);
      expect(await Studio.getAll()).to.have.lengthOf(1);

      const searchResult = await searchStudios({
        query: "fidelity",
      });
      expect(searchResult).to.deep.equal({
        items: [studio._id],
        total: 1,
        numPages: 1,
      });
    });
  });
});
