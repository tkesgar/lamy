import knex from "knex";
import {
  getConnection,
  setConnection,
  Row,
  findAll,
  find,
  insertAll,
  insert,
  countAll,
} from "..";

const testConnection = knex({
  client: "mysql2",
  connection: {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_NAME,
  },
});

function createTestRow(): { row: Row; conn: knex } {
  const conn = knex({ client: "mysql2" });

  const row = new Row(
    "kansen",
    {
      id: 252,
      time_created: new Date("1986-12-28"),
      time_updated: new Date("1988-12-08"),
      time_deleted: new Date("1997-07-22"),
      key: "graf_zeppelin",
      name: "Graf Zeppelin",
      score: 40,
    },
    { conn }
  );

  return { row, conn };
}

beforeAll(async () => {
  setConnection(testConnection);

  await getConnection().schema.createTable("kansen", (table) => {
    table.increments("id");

    table.timestamp("time_created").defaultTo(getConnection().fn.now());
    table
      .timestamp("time_updated")
      .defaultTo(
        getConnection().raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
      );
    table.timestamp("time_deleted").nullable().defaultTo(null);

    table.string("key");
    table.string("name");
    table.integer("score");
  });
});

afterAll(async () => {
  await getConnection().schema.dropTable("kansen");
  await getConnection().destroy();
});

describe("getConnection() test", () => {
  const kansenTable = [
    [1, "karlsruhe", "Karlsruhe", 10],
    [2, "leipzig", "Leipzig", 20],
    [3, "z23", "Z23", 30],
    [4, "prinz_eugen", "Prinz Eugen", 40],
    [5, "odin", "Odin", 45],
    [6, "friedrich_der_grosse", "Friedrich der Große", 55],
  ];

  beforeEach(async () => {
    await getConnection()("kansen").insert(
      kansenTable.map(([id, key, name, score]) => ({
        id,
        key,
        name,
        score,
      }))
    );
  });

  afterEach(async () => {
    await getConnection()("kansen").truncate();
  });

  describe("findAll", () => {
    it("should return array of rows", async () => {
      const rows = await findAll({ tableName: "kansen" });

      expect(rows.find((row) => row.id === 1).getColumn<string>("name")).toBe(
        "Karlsruhe"
      );
      expect(rows.find((row) => row.id === 2).getColumn<string>("name")).toBe(
        "Leipzig"
      );
      expect(rows.find((row) => row.id === 4).getColumn<string>("name")).toBe(
        "Prinz Eugen"
      );
      expect(rows.find((row) => row.id === 6).getColumn<string>("name")).toBe(
        "Friedrich der Große"
      );
    });

    it("should return empty array if row does not exist", async () => {
      const rows = await findAll({
        tableName: "kansen",
        where() {
          this.where("score", ">=", 60);
        },
      });

      expect(rows).toEqual([]);
    });

    it("should support pagination", async () => {
      const [rowsPage1, rowsPage2] = await Promise.all([
        findAll({
          tableName: "kansen",
          pagination: { limit: 4 },
        }),
        findAll({
          tableName: "kansen",
          pagination: { limit: 4, page: 2 },
        }),
      ]);

      expect(rowsPage1).toHaveLength(4);
      expect(rowsPage2).toHaveLength(2);

      for (const row of rowsPage1) {
        expect(
          rowsPage2.find((findRow) => findRow.id === row.id)
        ).toBeUndefined();
      }

      for (const row of rowsPage2) {
        expect(
          rowsPage1.find((findRow) => findRow.id === row.id)
        ).toBeUndefined();
      }
    });
  });

  describe("find", () => {
    it("should return a row", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where({ score: 30 });
        },
      });

      expect(row.getColumn<string>("name")).toBe("Z23");
    });

    it("should return null if row does not exist", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "graf_zeppelin" });
        },
      });

      expect(row).toBeNull();
    });
  });

  describe("countAll", () => {
    it("should return count of rows", async () => {
      const count = await countAll({ tableName: "kansen" });
      expect(count).toBe(6);
    });

    it("should return count of rows based on query", async () => {
      const count = await countAll({
        tableName: "kansen",
        where() {
          this.where("score", ">=", 30);
        },
      });

      expect(count).toBe(4);
    });

    it("should exclude deleted rows", async () => {
      const rowsToBeDeleted = await findAll({
        tableName: "kansen",
        where() {
          this.where(getConnection().raw("MOD(score, 2)"), "<>", 0);
        },
      });

      await Promise.all(rowsToBeDeleted.map((row) => row.delete()));

      const count = await countAll({
        tableName: "kansen",
        where() {
          this.where("score", ">=", 20);
        },
      });

      expect(count).toBe(3);
    });
  });

  describe("insertAll", () => {
    it("should insert new rows", async () => {
      await insertAll("kansen", [
        {
          key: "mainz",
          name: "Mainz",
          score: 45,
        },
        {
          key: "roon",
          name: "Roon",
          score: 45,
        },
      ]);

      const [mainzRow, roonRow] = await Promise.all([
        find({
          tableName: "kansen",
          where() {
            this.where("key", "mainz");
          },
        }),
        find({
          tableName: "kansen",
          where() {
            this.where("key", "roon");
          },
        }),
      ]);

      expect(mainzRow.getColumn<number>("name")).toBe("Mainz");
      expect(roonRow.getColumn<number>("name")).toBe("Roon");
    });
  });

  describe("insert", () => {
    it("should insert a new row and return the new auto increment", async () => {
      const id = await insert("kansen", {
        key: "u_47",
        name: "U-47",
        score: 40,
      });

      const newRow = await find({
        tableName: "kansen",
        where() {
          this.where({ id });
        },
      });

      expect(newRow.getColumn("name")).toBe("U-47");
      expect(newRow.getColumn("score")).toBe(40);
    });
  });

  describe("setColumns", () => {
    it("should update data both on row and on getConnection()", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "z23" });
        },
      });

      await row.setColumns({
        key: "z23_retrofit",
        name: "Z23 (Retrofit)",
        score: 40,
      });

      expect(row.getColumn("key")).toBe("z23_retrofit");
      expect(row.getColumn("name")).toBe("Z23 (Retrofit)");
      expect(row.getColumn("score")).toBe(40);

      const updatedRow = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "z23_retrofit" });
        },
      });

      expect(updatedRow.getColumn("name")).toBe("Z23 (Retrofit)");
      expect(updatedRow.getColumn("score")).toBe(40);
    });

    it("should throw error if column does not exist", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where("key", "prinz_eugen");
        },
      });

      await expect(row.setColumns({ status: "ok" })).rejects.toThrow(
        `Column 'status' does not exist for table kansen`
      );
    });
  });

  describe("setColumn", () => {
    it("should update data", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "odin" });
        },
      });

      await row.setColumn("name", "KMS Odin");

      expect(row.getColumn("name")).toBe("KMS Odin");

      const updatedRow = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "odin" });
        },
      });

      expect(updatedRow.getColumn("name")).toBe("KMS Odin");
    });
  });

  describe("soft delete", () => {
    it("delete should mark row as deleted and restore should mark row as not deleted", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "karlsruhe" });
        },
      });

      await row.delete();

      const deletedRow = await find({
        tableName: "kansen",
        includeDeleted: true,
        where() {
          this.where({ key: "karlsruhe" });
        },
      });

      expect(deletedRow.isDeleted).toBe(true);

      await deletedRow.restore();

      const restoredRow = await find({
        tableName: "kansen",
        includeDeleted: true,
        where() {
          this.where({ key: "karlsruhe" });
        },
      });

      expect(restoredRow.isDeleted).toBe(false);
    });

    it("should not retrieve deleted rows if excludeDeleted is true", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "karlsruhe" });
        },
      });

      await row.delete();

      expect(
        await find({
          tableName: "kansen",
          where() {
            this.where({ key: "karlsruhe" });
          },
        })
      ).toBeNull();
    });
  });

  describe("hard delete", () => {
    it("delete the row from table", async () => {
      const row = await find({
        tableName: "kansen",
        where() {
          this.where({ key: "z23" });
        },
      });

      await row.deletePermanently();

      expect(
        await find({
          tableName: "kansen",
          where() {
            this.where({ key: "z23" });
          },
        })
      ).toBeNull();
    });
  });

  describe("custom primary key", () => {
    it("should only set specific row with the primary key", async () => {
      const [rowData] = await getConnection()("kansen").where({
        key: "leipzig",
      });
      const row = new Row("kansen", rowData, { primaryCols: ["key"] });

      await row.setColumns({
        key: "leipzig_retrofit",
        name: "Leipzig (retrofit)",
        score: 30,
      });

      const updatedRows = await findAll({
        tableName: "kansen",
        where() {
          this.where({ key: "leipzig_retrofit" });
        },
      });

      expect(updatedRows).toHaveLength(1);
    });
  });
});

describe("isColumn", () => {
  it("should return true if column exists", () => {
    const { row } = createTestRow();
    expect(row.isColumn("score")).toBe(true);
  });

  it("should return false if column does not exist", () => {
    const { row } = createTestRow();
    expect(row.isColumn("status")).toBe(false);
  });
});

describe("getColumn", () => {
  it("should return column value if column exists", () => {
    const { row } = createTestRow();
    expect(row.getColumn<string>("name")).toBe("Graf Zeppelin");
  });

  it("should throw error if column does not exist", () => {
    const { row } = createTestRow();
    expect(() => row.getColumn<string>("status")).toThrow(
      "Column 'status' does not exist for table kansen"
    );
  });
});

it("row.query should return query for row", () => {
  const { row } = createTestRow();

  const { bindings, sql } = row.query.toSQL();

  expect(sql).toEqual("select * from `kansen` where `id` = ?");
  expect(bindings).toEqual([252]);
});

describe("getters", () => {
  it("should return values for timeCreated, timeUpdated, and timeDeleted", () => {
    const { row } = createTestRow();

    expect(row.timeCreated).toEqual(new Date("1986-12-28"));
    expect(row.timeUpdated).toEqual(new Date("1988-12-08"));
    expect(row.timeDeleted).toEqual(new Date("1997-07-22"));
  });
});

describe("connection", () => {
  it("get should return connection", () => {
    const { row, conn } = createTestRow();
    expect(row.connection).toBe(conn);
  });

  it("set should set new connection", () => {
    const { row } = createTestRow();
    const newConn = knex({ client: "mysql2" });

    row.connection = newConn;

    expect(row.connection).toBe(newConn);
  });

  it("set should use initial connection if set to null", () => {
    const { row, conn } = createTestRow();
    const newConn = knex({ client: "mysql2" });

    row.connection = newConn;
    expect(row.connection).toBe(newConn);

    row.connection = null;
    expect(row.connection).toBe(conn);
  });
});
