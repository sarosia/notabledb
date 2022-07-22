const Database = require('../lib/database');
const InMemoryStorage = require('../lib/in_memory_storage');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

describe('Database', () => {
  const storage = new InMemoryStorage();
  storage.write({
    users: {
      "userid-1": {
        name: "Alice"
      },
      "userid-2": {
        name: "Bob"
      }
    }
  });
  const database = new Database(storage);

  describe('#query', () => {
    it('Empty path', async () => {
      expect(await database.query([])).to.deep.equal({
        users: {
          "userid-1": {
            name: "Alice"
          },
          "userid-2": {
            name: "Bob"
          }
        }
      });
    });

    it('Existing item', async () => {
      expect(await database.query(['users', 'userid-1'])).to.deep.equal({
        name: "Alice"
      });
    });

    it('Non-existing item', async () => {
      expect(await database.query(['nonexistingpath'])).to.equal(null);
    });
  });

  describe('#update', () => {
    it('Update item', async () => {
      await database.update(['users', 'userid-1', 'name'], 'Alex');
      expect(await storage.read()).to.deep.equal({
        users: {
          "userid-1": {
            name: "Alex"
          },
          "userid-2": {
            name: "Bob"
          }
        }
      });
    });
    it('Non-existing item', async () => {
      expect(database.update(['users', 'userid-3', 'name'], 'Calvin')).to.be.rejected;
      expect(await storage.read()).to.deep.equal({
        users: {
          "userid-1": {
            name: "Alex"
          },
          "userid-2": {
            name: "Bob"
          }
        }
      });
    });
  });
});
