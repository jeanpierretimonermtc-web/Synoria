import React from 'react'
import type { SystemesQuestionnaire } from '../../../../shared/types'
import SystemesForm from '../../forms/SystemesForm'

export function emptySystemes(): SystemesQuestionnaire {
  return {
    cardio:       { checked: [], note: '' },
    pulmo:        { checked: [], note: '' },
    mental:       { checked: [], note: '', stress: 0, anxiete: 0 },
    vision:       { checked: [], note: '' },
    reins:        { checked: [], note: '' },
    rate:         { checked: [], note: '', energie: 0, regimeAlimentaire: '' },
    estomac:      { checked: [], note: '' },
    grosIntestin: { checked: [], note: '' },
    peau:         { checked: [], note: '', emplacementAcne: '', emplacementEczema: '' },
    tete:         { checked: [], note: '' },
    temp:         { checked: [], note: '' },
    musculo:      { checked: [], note: '', douleur: 0, localisation: '' },
    feminin: {
      checked: [], note: '',
      ageMenarche: '', jourCycle: '', longueurCycle: '',
      dureeMin: '', dureeMax: '', couleurSang: '', ecoulement: '',
      caillots: [], crampes: [], spm: [],
    },
    fertilite: {
      checked: [], note: '',
      essaiConception: '', testsSanguins: '', resultatTests: '',
      diagnosticFertilite: [], debutMenopause: '',
      enceinte: false, nbSemaines: '', cesarienne: false,
      datePrevue: '', enfants: false,
    },
    masculin: { checked: [], note: '' },
  }
}

export default function MtcSystemesModule({ value, onChange }: {
  value: SystemesQuestionnaire | null | undefined
  onChange: (v: SystemesQuestionnaire) => void
}) {
  return <SystemesForm systemes={value ?? emptySystemes()} onChange={onChange} />
}
