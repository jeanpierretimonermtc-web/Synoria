/**
 * Point d'entrée du registre de modules (Phase 4).
 *
 * Importer ce fichier enregistre tous les adaptateurs natifs dans le registre
 * global `pluginModuleRegistry`. Appeler depuis le main process au démarrage
 * (avant tout accès à getModuleAdapter).
 *
 * Usage : import '../services/moduleAdapters'  // ou /index
 */

import { registerModuleAdapter } from '../../../shared/pluginModuleRegistry'
import { mtcSystemesAdapter }          from './mtcSystemesAdapter'
import { mtcFiveElementsAdapter }      from './mtcFiveElementsAdapter'
import { mtcTonguePulseAdapter }       from './mtcTonguePulseAdapter'
import { mtcAideInterrogatoireAdapter } from './mtcAideInterrogatoireAdapter'
import { osteoOrthoTestsAdapter }      from './osteoOrthoTestsAdapter'
import { osteoPostureAdapter }         from './osteoPostureAdapter'

registerModuleAdapter(mtcSystemesAdapter)
registerModuleAdapter(mtcFiveElementsAdapter)
registerModuleAdapter(mtcTonguePulseAdapter)
registerModuleAdapter(mtcAideInterrogatoireAdapter)
registerModuleAdapter(osteoOrthoTestsAdapter)
registerModuleAdapter(osteoPostureAdapter)
