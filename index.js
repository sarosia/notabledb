const Client = require('./lib/client');
const Database = require('./lib/database');
const Storage = require('./lib/storage');
const FilesystemStorage = require('./lib/filesystem_storage');
const InMemoryStorage = require('./lib/in_memory_storage');

Client.Client = Client;
Client.Database = Database;
Client.Storage = Storage;
Client.FilesystemStorage = FilesystemStorage;
Client.InMemoryStorage = InMemoryStorage;

module.exports = Client;
