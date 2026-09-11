/**
 * Offline verification that the package manifest still describes a valid DSH
 * bundle.
 *
 * A bundle is a package whose `dsh.bundle.patch` names a patch file that ships
 * in the tarball and mounts the package itself. Getting either half wrong fails
 * loud but late — at profile boot, on a user's machine — so the two halves are
 * pinned here: the patch must be published (`files`), and it must insert this
 * package's own name. The `dsh.client` half is checked the same way: a package
 * that declares it but exports no `./client` bundle aborts the client-module
 * scan.
 *
 * @module commandcode-dash/test/manifest
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { check, root } from './helpers.mjs'

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const bundle = manifest.dsh?.bundle
const client = manifest.dsh?.client
const files = new Set((manifest.files ?? []).map((file) => file.replace(/^\.\//, '')))

console.log('manifest')

check.ok('declares dsh.bundle.patch', typeof bundle?.patch === 'string')
check.ok('ships the patch file in files[]', files.has(bundle?.patch?.replace(/^\.\//, '')))

if (typeof bundle?.patch === 'string') {
  const patch = readFileSync(join(root, bundle.patch), 'utf8')
  // No YAML parser is available offline, so assert the structural lines the
  // composition depends on rather than the parsed document.
  check.ok('patch is one top-level insert list', /^-\s*insert:\s*$/m.test(patch))
  check.ok('patch inserts id commandcode', /^\s*-\s*id:\s*commandcode\s*$/m.test(patch))
  check.ok(
    'patch mounts this package by name',
    new RegExp(`^\\s*name:\\s*${manifest.name}\\s*$`, 'm').test(patch),
  )
}

check.ok('declares dsh.client for the web platform', client?.platform === 'web')
check.ok('exports the ./client bundle it declares', manifest.exports?.['./client'] !== undefined)
check.ok('ships the client bundle in files[]', files.has(manifest.exports?.['./client']?.replace(/^\.\//, '')))
