import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { catalogSchema, emptyCatalog } from "../src/lib/catalog";
import { openDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import { createFullBackup, prepareFullRestore } from "../src/lib/full-backup";

test("sociedades compartidas sobreviven cambios, reapertura, migración antigua y copias JSON/ZIP", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "da-pro-catalog-"));
  const filename = path.join(directory, "catalog.sqlite");
  let db = openDatabase(filename);
  try {
    const entities = ["Primera", "Segunda"].map(title=>({id:randomUUID(),kind:"work",title,code:"",genre:"",year:"",language:"",lyrics:"",notes:"",url:"",sourceUrls:[],publication:"unchecked"}));
    const legacy = {...structuredClone(emptyCatalog),entities,registrations:entities.map(entity=>({id:randomUUID(),entityId:entity.id,agency:"PRO",organization:"  Sociedad   Nueva  ",status:"unchecked",applicable:"unknown",evidenceUrl:"",verifiedAt:"",notes:"",sourceValues:[]}))};
    const {proOrganizations: _options,...oldJson} = legacy;
    let saved = writeCatalog(db,catalogSchema.parse(oldJson));
    assert.deepEqual(saved.proOrganizations,["BMI","ASCAP","SGAE","Sociedad Nueva"]);
    saved.registrations[1].organization=" sociedad  NUEVA ";
    saved = writeCatalog(db,saved);
    assert.equal(saved.proOrganizations.length,4);
    assert.equal(saved.registrations[1].organization,"Sociedad Nueva");
    db.exec("DROP TABLE pro_organizations");
    db.close(); db = openDatabase(filename);
    saved=readCatalog(db);
    assert.ok(saved.proOrganizations.includes("Sociedad Nueva"));
    saved.registrations=[];
    saved.proOrganizations=[];
    saved=writeCatalog(db,saved);
    db.close(); db=openDatabase(filename);
    assert.ok(readCatalog(db).proOrganizations.includes("Sociedad Nueva"));
    const json=catalogSchema.parse(JSON.parse(JSON.stringify(readCatalog(db))));
    assert.ok(json.proOrganizations.includes("Sociedad Nueva"));
    const zipPath=path.join(directory,"backup.zip");
    await pipeline(await createFullBackup(json),createWriteStream(zipPath));
    const restored=await prepareFullRestore(zipPath);
    const target=openDatabase(":memory:");
    try {
      writeCatalog(target,{...restored.catalog,revision:0});
      assert.deepEqual(readCatalog(target).proOrganizations,json.proOrganizations);
    } finally { target.close(); await restored.cleanup(); }
    const distinct=catalogSchema.parse({...json,proOrganizations:[...json.proOrganizations,"Sociedad Nueva Internacional"]});
    assert.equal(distinct.proOrganizations.length,5);
  } finally {db.close(); await rm(directory,{recursive:true,force:true});}
});
