import { expect } from "chai";

import Movie from "../../src/types/movie";
import { indexMovies, searchMovies } from "../../src/search/movie";
import { startTestServer, stopTestServer } from "../testServer";
import { collections } from "../../src/database";

describe("Search", () => {
  describe("Movie", () => {
    const movie = new Movie("Ginebra Bellucci - Outdoor Anal Action");

    before(async function () {
      await startTestServer.call(this);

      expect(await Movie.getAll()).to.be.empty;
      await collections.movies.upsert(movie._id, movie);
      await indexMovies([movie]);
      expect(await Movie.getAll()).to.have.lengthOf(1);
    });

    after(() => {
      stopTestServer();
    });

    it("Should find movie by name", async function () {
      const searchResult = await searchMovies({
        query: "ginebra",
      });
      expect(searchResult).to.deep.equal({
        items: [movie._id],
        total: 1,
        numPages: 1,
      });
    });

    it("Should not find movie with bad query", async function () {
      const searchResult = await searchMovies({
        query: "asdva35aeb5se5b",
      });
      expect(searchResult).to.deep.equal({
        items: [],
        total: 0,
        numPages: 0,
      });
    });

    it("Should find movie with 1 typo", async function () {
      const searchResult = await searchMovies({
        query: "Belucci",
      });
      expect(searchResult).to.deep.equal({
        items: [movie._id],
        total: 1,
        numPages: 1,
      });
    });

    it("Should find movie by name with underscores", async function () {
      stopTestServer();
      await startTestServer.call(this);

      expect(await Movie.getAll()).to.be.empty;
      const movie = new Movie("Ginebra_Bellucci - Outdoor Anal Action");
      await collections.movies.upsert(movie._id, movie);
      await indexMovies([movie]);
      expect(await Movie.getAll()).to.have.lengthOf(1);

      const searchResult = await searchMovies({
        query: "ginebra",
      });
      expect(searchResult).to.deep.equal({
        items: [movie._id],
        total: 1,
        numPages: 1,
      });
    });
  });
});
