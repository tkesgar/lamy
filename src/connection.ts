/* istanbul ignore file */
import knex, { Transaction } from "knex";

export type Connection = knex | Transaction;

export interface ConnectionOpts {
  conn?: Connection;
}

let _defaultConnection: Connection = null;

export function getConnection(): Connection {
  if (!_defaultConnection) {
    throw new Error("Default connection is not set");
  }

  return _defaultConnection;
}

export function setConnection(conn: Connection): void {
  _defaultConnection = conn;
}
