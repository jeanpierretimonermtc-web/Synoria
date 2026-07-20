import React, { useState } from 'react'
import type { SystemesQuestionnaire } from '../../../shared/types'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function ScoreRow({ label, value, max = 10, onChange }: {
  label: string; value: number; max?: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>
        {label}
      </div>
      <div className="score-btns">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            className={`score-btn${value === n ? ' active' : ''}`}
            onClick={() => onChange(value === n ? 0 : n)}
          >{n}</button>
        ))}
      </div>
    </div>
  )
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="check-item">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )
}

function InlineTag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <span
      className={`tag${active ? ' active' : ''}`}
      onClick={onClick}
      style={{ fontSize: 11, padding: '2px 9px', cursor: 'pointer' }}
    >{label}</span>
  )
}

function NoteBox({ value, onChange, placeholder = 'Notes…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', minHeight: 52, marginTop: 8, fontSize: 12, resize: 'vertical' }}
    />
  )
}

function FieldInput({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: 'auto', minWidth: 80, maxWidth: 140, padding: '3px 8px', fontSize: 12, display: 'inline' }}
      />
    </div>
  )
}

// Colored card wrapper — collapsible
function SysCard({ title, icon, accentColor, colSpan, defaultOpen = false, children }: {
  title: string; icon: string; accentColor: string; colSpan?: boolean; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={`sys-card${open ? '' : ' collapsed'}`}
      style={{ borderLeft: `3px solid ${accentColor}`, gridColumn: colSpan ? '1 / -1' : undefined }}
    >
      <button className="sys-card-toggle" onClick={() => setOpen(o => !o)}>
        <div className="sys-card-title">
          <span className="card-title-icon" style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: accentColor }}>
            {icon}
          </span>
          {title}
        </div>
        <span className="sys-card-toggle-icon">▼</span>
      </button>
      {open && <div className="sys-card-body">{children}</div>}
    </div>
  )
}

// Small divider
const HR = () => <hr style={{ margin: '8px 0', borderColor: 'var(--border-soft)' }} />

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface Props {
  systemes: SystemesQuestionnaire
  onChange: (s: SystemesQuestionnaire) => void
}

export default function SystemesForm({ systemes, onChange }: Props) {
  // Generic setter
  function set<K extends keyof SystemesQuestionnaire>(key: K, updates: Partial<SystemesQuestionnaire[K]>) {
    onChange({ ...systemes, [key]: { ...(systemes[key] as any), ...updates } })
  }

  // Toggle a checked item
  function chk(key: keyof SystemesQuestionnaire, val: string) {
    const s = systemes[key] as { checked: string[] }
    const checked = s.checked.includes(val)
      ? s.checked.filter(x => x !== val)
      : [...s.checked, val]
    set(key, { checked } as any)
  }

  // Toggle item in a sub-array (e.g. caillots, crampes, spm)
  function tog(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  const { cardio, pulmo, mental, vision, reins, rate, estomac,
          grosIntestin, peau, tete, temp, musculo, feminin, fertilite, masculin } = systemes

  return (
    <div className="sys-grid">

      {/* ══ CARDIAQUE / SOMMEIL ══════════════════════════════════ */}
      <SysCard title="Système cardiaque / Sommeil" icon="🫀" accentColor="var(--rose)">
        <div className="check-group">
          {[
            'Mettez-vous longtemps à vous endormir',
            'Vous retournez-vous toute la nuit',
            'Vous réveillez-vous entre 1h et 3h du matin',
            'Rêves récurrents ou cauchemars',
            'Sueurs nocturnes – chaud la nuit',
            'Transpirez-vous lorsque vous êtes anxieux',
            'Palpitations – oppression thoracique',
          ].map(v => <Chk key={v} label={v} checked={cardio.checked.includes(v)} onChange={() => chk('cardio', v)} />)}
        </div>
        <NoteBox value={cardio.note} onChange={v => set('cardio', { note: v })} />
      </SysCard>

      {/* ══ PULMONAIRE ═══════════════════════════════════════════ */}
      <SysCard title="Système pulmonaire" icon="🫁" accentColor="var(--blue)">
        <div className="check-group">
          {[
            'Essoufflement',
            'Difficultés respiratoires, asthme',
            'Allergies environnementales',
            'Attrapez-vous facilement rhumes et grippes',
            'Toux sèche ou avec expectorations',
            'Problèmes de sinus, écoulement post-nasal',
            'Apnée du sommeil',
            'Le rétablissement prend-il beaucoup de temps',
          ].map(v => <Chk key={v} label={v} checked={pulmo.checked.includes(v)} onChange={() => chk('pulmo', v)} />)}
        </div>
        <NoteBox value={pulmo.note} onChange={v => set('pulmo', { note: v })} />
      </SysCard>

      {/* ══ SANTÉ MENTALE ════════════════════════════════════════ */}
      <SysCard title="Santé mentale" icon="🧠" accentColor="var(--purple)">
        <ScoreRow label="Niveau de stress" value={mental.stress} onChange={v => set('mental', { stress: v })} />
        <ScoreRow label="Niveau d'anxiété" value={mental.anxiete} onChange={v => set('mental', { anxiete: v })} />
        <div className="check-group" style={{ marginTop: 6 }}>
          {[
            'Mémoire à court terme faible',
            'Mémoire à long terme faible',
            'Incapacité à retenir les informations',
            'Concentration, attention faibles',
            'Difficulté à lâcher prise',
            'Irritable – frustré – en colère',
            'Sentiment d\'être bloqué',
            'Déprimé – triste – mélancolique',
            'Incapacité à prendre des décisions',
            'Doute de soi – faible estime de soi',
            'Envie – jalousie envers les autres',
            'Inquiétude – réflexion excessive – hypersensibilité',
          ].map(v => <Chk key={v} label={v} checked={mental.checked.includes(v)} onChange={() => chk('mental', v)} />)}
        </div>
        <NoteBox value={mental.note} onChange={v => set('mental', { note: v })} />
      </SysCard>

      {/* ══ VISION & AUDITION ════════════════════════════════════ */}
      <SysCard title="Vision et Audition" icon="👁" accentColor="var(--teal)">
        <div className="check-group">
          {[
            'Acouphènes aigus – intermittents',
            'Acouphènes graves – constants',
            'Douleur auriculaire',
            'Oreilles bouchées',
            'Vision floue',
            'Corps flottants – taches',
            'Vision nocturne médiocre',
            'Yeux secs',
            'Larmoiement par vent ou yeux croûtés',
            'Clignement des yeux',
            'Vertiges',
          ].map(v => <Chk key={v} label={v} checked={vision.checked.includes(v)} onChange={() => chk('vision', v)} />)}
        </div>
        <NoteBox value={vision.note} onChange={v => set('vision', { note: v })} />
      </SysCard>

      {/* ══ SANTÉ FÉMININE ═══════════════════════════════════════ */}
      <SysCard title="Santé Féminine" icon="♀" accentColor="var(--rose-mid)">
        {/* Champs texte */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 8 }}>
          <FieldInput label="Âge à la ménarche :" value={feminin.ageMenarche} onChange={v => set('feminin', { ageMenarche: v })} placeholder="ex: 13" />
          <FieldInput label="Jour actuel du cycle :" value={feminin.jourCycle} onChange={v => set('feminin', { jourCycle: v })} />
          <FieldInput label="Longueur du cycle :" value={feminin.longueurCycle} onChange={v => set('feminin', { longueurCycle: v })} placeholder="ex: 28j" />
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Durée menstruations :</span>
            <input type="text" value={feminin.dureeMin} onChange={e => set('feminin', { dureeMin: e.target.value })} placeholder="min" style={{ width: 40, padding: '3px 6px', fontSize: 12, display: 'inline' }} />
            <span style={{ fontSize: 12 }}>à</span>
            <input type="text" value={feminin.dureeMax} onChange={e => set('feminin', { dureeMax: e.target.value })} placeholder="max" style={{ width: 40, padding: '3px 6px', fontSize: 12, display: 'inline' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>jours</span>
          </div>
        </div>
        <FieldInput label="Couleur du sang :" value={feminin.couleurSang} onChange={v => set('feminin', { couleurSang: v })} placeholder="Rouge vif, foncé, rosé…" />

        {/* Écoulement */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>Écoulement :</span>
          {['léger', 'moyen', 'abondant', 'hémorragique'].map(v => (
            <InlineTag key={v} label={v} active={feminin.ecoulement === v}
              onClick={() => set('feminin', { ecoulement: feminin.ecoulement === v ? '' : v })} />
          ))}
        </div>

        <HR />

        {/* Caillots */}
        <div style={{ marginBottom: 6 }}>
          <Chk label="Caillots :" checked={feminin.checked.includes('Caillots')} onChange={() => chk('feminin', 'Caillots')} />
          {feminin.checked.includes('Caillots') && (
            <div style={{ marginLeft: 22, display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
              {['petits', 'moyens', 'grands'].map(v => (
                <InlineTag key={v} label={v} active={feminin.caillots.includes(v)}
                  onClick={() => set('feminin', { caillots: tog(feminin.caillots, v) })} />
              ))}
            </div>
          )}
        </div>

        {/* Crampes */}
        <div style={{ marginBottom: 6 }}>
          <Chk label="Crampes :" checked={feminin.checked.includes('Crampes')} onChange={() => chk('feminin', 'Crampes')} />
          {feminin.checked.includes('Crampes') && (
            <div style={{ marginLeft: 22, display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
              {['légères', 'aiguës'].map(v => (
                <InlineTag key={v} label={v} active={feminin.crampes.includes(v)}
                  onClick={() => set('feminin', { crampes: tog(feminin.crampes, v) })} />
              ))}
            </div>
          )}
        </div>

        {/* SPM */}
        <div style={{ marginBottom: 6 }}>
          <Chk label="SPM :" checked={feminin.checked.includes('SPM')} onChange={() => chk('feminin', 'SPM')} />
          {feminin.checked.includes('SPM') && (
            <div style={{ marginLeft: 22, display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
              {['seins tendus', 'ballonnements', 'envies', 'fatigue', 'douleur lombaire'].map(v => (
                <InlineTag key={v} label={v} active={feminin.spm.includes(v)}
                  onClick={() => set('feminin', { spm: tog(feminin.spm, v) })} />
              ))}
            </div>
          )}
        </div>

        {/* Autres */}
        <div className="check-group">
          {[
            'Douleur à l\'ovulation',
            'Douleur lors des rapports sexuels',
            'Écoulement vaginal anormal',
          ].map(v => <Chk key={v} label={v} checked={feminin.checked.includes(v)} onChange={() => chk('feminin', v)} />)}
        </div>
        <NoteBox value={feminin.note} onChange={v => set('feminin', { note: v })} />
      </SysCard>

      {/* ══ REINS / VESSIE ═══════════════════════════════════════ */}
      <SysCard title="Reins / Vessie" icon="💧" accentColor="var(--blue-mid)">
        <div className="check-group">
          {[
            'Urine foncée et rare',
            'Urine goutte à goutte',
            'Urine à forte odeur',
            'Miction fréquente et urgente',
            'Miction douloureuse – brûlante',
            'Incontinence urinaire',
            'Réveil nocturne pour uriner',
          ].map(v => <Chk key={v} label={v} checked={reins.checked.includes(v)} onChange={() => chk('reins', v)} />)}
        </div>
        <HR />
        <div className="check-group">
          {[
            'Cheveux gris prématurés',
            'Perte de cheveux',
            'Antécédents de fracture(s)',
            'Faible densité osseuse',
            'Œdème des membres inférieurs',
            'Port des appareils dentaires dans l\'enfance',
          ].map(v => <Chk key={v} label={v} checked={reins.checked.includes(v)} onChange={() => chk('reins', v)} />)}
        </div>
        <NoteBox value={reins.note} onChange={v => set('reins', { note: v })} />
      </SysCard>

      {/* ══ FERTILITÉ ════════════════════════════════════════════ */}
      <SysCard title="Fertilité" icon="🌱" accentColor="var(--amber)">
        <div className="check-group" style={{ marginBottom: 8 }}>
          <Chk label="Contraception" checked={fertilite.checked.includes('Contraception')} onChange={() => chk('fertilite', 'Contraception')} />
          <Chk label="Consultation d'un endocrinologue" checked={fertilite.checked.includes("Consultation d'un endocrinologue")} onChange={() => chk('fertilite', "Consultation d'un endocrinologue")} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
          <FieldInput label="Essai de conception depuis :" value={fertilite.essaiConception} onChange={v => set('fertilite', { essaiConception: v })} />
          <FieldInput label="Tests sanguins jours 3–21 :" value={fertilite.testsSanguins} onChange={v => set('fertilite', { testsSanguins: v })} />
          <FieldInput label="Résultats des tests sanguins :" value={fertilite.resultatTests} onChange={v => set('fertilite', { resultatTests: v })} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Diagnostic de fertilité :</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['IUI – avec médicaments', 'FIV'].map(v => (
              <InlineTag key={v} label={v}
                active={fertilite.diagnosticFertilite.includes(v)}
                onClick={() => set('fertilite', { diagnosticFertilite: tog(fertilite.diagnosticFertilite, v) })} />
            ))}
          </div>
        </div>

        <HR />

        {/* Ménopause */}
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Début de la ménopause à</span>
          <input type="text" value={fertilite.debutMenopause} onChange={e => set('fertilite', { debutMenopause: e.target.value })} placeholder="âge" style={{ width: 50, padding: '3px 6px', fontSize: 12, display: 'inline' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ans</span>
        </div>
        <div className="check-group">
          <Chk label="Sueurs nocturnes – bouffées de chaleur" checked={fertilite.checked.includes('Sueurs nocturnes – bouffées de chaleur')} onChange={() => chk('fertilite', 'Sueurs nocturnes – bouffées de chaleur')} />
          <Chk label="Sécheresse vaginale" checked={fertilite.checked.includes('Sécheresse vaginale')} onChange={() => chk('fertilite', 'Sécheresse vaginale')} />
        </div>

        <HR />

        {/* Grossesse */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
          <label className="check-item"><input type="checkbox" checked={fertilite.enceinte} onChange={() => set('fertilite', { enceinte: !fertilite.enceinte })} /> Enceinte</label>
          <label className="check-item"><input type="checkbox" checked={fertilite.enfants} onChange={() => set('fertilite', { enfants: !fertilite.enfants })} /> Enfants</label>
          <label className="check-item"><input type="checkbox" checked={fertilite.cesarienne} onChange={() => set('fertilite', { cesarienne: !fertilite.cesarienne })} /> Césarienne</label>
        </div>
        {fertilite.enceinte && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <FieldInput label="Semaines :" value={fertilite.nbSemaines} onChange={v => set('fertilite', { nbSemaines: v })} />
            <FieldInput label="Date prévue d'accouchement :" value={fertilite.datePrevue} onChange={v => set('fertilite', { datePrevue: v })} />
          </div>
        )}
        <NoteBox value={fertilite.note} onChange={v => set('fertilite', { note: v })} />
      </SysCard>

      {/* ══ SANTÉ MASCULINE ══════════════════════════════════════ */}
      <SysCard title="Santé Masculine" icon="♂" accentColor="var(--teal)">
        <div className="check-group">
          {[
            'Libido faible',
            'Émission séminale',
            'Éjaculation précoce',
            'Dysfonction érectile',
            'Hyperplasie de la prostate',
            'Prostatite',
            'Faible numération spermatozoïde – motilité',
            'Faible morphologie des spermatozoïdes',
          ].map(v => <Chk key={v} label={v} checked={masculin.checked.includes(v)} onChange={() => chk('masculin', v)} />)}
        </div>
        <NoteBox value={masculin.note} onChange={v => set('masculin', { note: v })} />
      </SysCard>

      {/* ══ SYSTÈME DE LA RATE ═══════════════════════════════════ */}
      <SysCard title="Système de la Rate" icon="🌿" accentColor="var(--orange)">
        <ScoreRow label="Niveau d'énergie" value={rate.energie} onChange={v => set('rate', { energie: v })} />
        <div className="check-group">
          {[
            'Fatigue mentale',
            'Difficulté à se lever le matin',
            'Pas faim pour le petit-déjeuner',
            'Appétit faible',
            'Ballonnements après les repas',
            'Fatigue post-prandiale',
            'Sensibilités alimentaires',
          ].map(v => <Chk key={v} label={v} checked={rate.checked.includes(v)} onChange={() => chk('rate', v)} />)}
        </div>

        {/* Envies avec sous-options */}
        <div style={{ marginTop: 6 }}>
          <Chk label="Envies :" checked={rate.checked.includes('Envies')} onChange={() => chk('rate', 'Envies')} />
          <div style={{ marginLeft: 22, display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
            {['sucré', 'salé', 'gras'].map(v => (
              <InlineTag key={v} label={v}
                active={(rate as any).envies?.includes(v) ?? false}
                onClick={() => {
                  const envies = (rate as any).envies ?? []
                  set('rate', { envies: tog(envies, v) } as any)
                }} />
            ))}
          </div>
        </div>

        <HR />
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Régime alimentaire :</span>
        </div>
        <textarea
          value={rate.regimeAlimentaire}
          onChange={e => set('rate', { regimeAlimentaire: e.target.value })}
          placeholder="Végétarien, omnivore, sans gluten, allergies alimentaires…"
          style={{ width: '100%', minHeight: 50, fontSize: 12, resize: 'vertical' }}
        />
        <NoteBox value={rate.note} onChange={v => set('rate', { note: v })} />
      </SysCard>

      {/* ══ SYSTÈME DE L'ESTOMAC ═════════════════════════════════ */}
      <SysCard title="Système de l'Estomac" icon="🫙" accentColor="var(--amber)">
        <div className="check-group">
          {[
            'Aphtes : bouche – langue',
            'Mauvaise haleine – saignement des gencives',
            'Reflux acide – brûlures d\'estomac',
            'Soif de boissons froides',
            'Bouche sèche',
            'Faim constante',
            'Nausée – vomissements',
            'Difficulté à digérer les graisses',
          ].map(v => <Chk key={v} label={v} checked={estomac.checked.includes(v)} onChange={() => chk('estomac', v)} />)}
        </div>
        <NoteBox value={estomac.note} onChange={v => set('estomac', { note: v })} />
      </SysCard>

      {/* ══ SANTÉ DE LA PEAU ═════════════════════════════════════ */}
      <SysCard title="Santé de la Peau" icon="✨" accentColor="var(--accent)">
        <div className="check-group">
          <Chk label="Antécédents de problèmes de peau" checked={peau.checked.includes('Antécédents de problèmes de peau')} onChange={() => chk('peau', 'Antécédents de problèmes de peau')} />
          <Chk label="Acné" checked={peau.checked.includes('Acné')} onChange={() => chk('peau', 'Acné')} />
        </div>
        {peau.checked.includes('Acné') && (
          <FieldInput label="Emplacement de l'acné :" value={peau.emplacementAcne} onChange={v => set('peau', { emplacementAcne: v })} />
        )}
        <div className="check-group" style={{ marginTop: 4 }}>
          <Chk label="Eczéma" checked={peau.checked.includes('Eczéma')} onChange={() => chk('peau', 'Eczéma')} />
        </div>
        {peau.checked.includes('Eczéma') && (
          <FieldInput label="Emplacement de l'eczéma :" value={peau.emplacementEczema} onChange={v => set('peau', { emplacementEczema: v })} />
        )}
        <div className="check-group" style={{ marginTop: 4 }}>
          {[
            'Psoriasis',
            'Peau grasse',
            'Peau sèche',
            'Éruptions cutanées',
          ].map(v => <Chk key={v} label={v} checked={peau.checked.includes(v)} onChange={() => chk('peau', v)} />)}
        </div>
        <NoteBox value={peau.note} onChange={v => set('peau', { note: v })} />
      </SysCard>

      {/* ══ GROS INTESTIN ════════════════════════════════════════ */}
      <SysCard title="Gros Intestin" icon="🔄" accentColor="var(--blue)">
        <div className="check-group">
          {[
            'Constipation',
            'Effort lors de la défécation',
            'Gaz – sensation de non-évacuation après la défécation',
            'Selles molles',
            'Diarrhée',
            'Diarrhée odorante – présence de sang dans les selles',
            'Diarrhée urgente et douloureuse',
            'Alternance diarrhée et constipation',
            'Selles dures, petites, sèches, en forme de cailloux',
            'Selles collantes',
            'Présence d\'aliments non digérés dans les selles',
          ].map(v => <Chk key={v} label={v} checked={grosIntestin.checked.includes(v)} onChange={() => chk('grosIntestin', v)} />)}
        </div>
        <NoteBox value={grosIntestin.note} onChange={v => set('grosIntestin', { note: v })} />
      </SysCard>

      {/* ══ MAUX DE TÊTE ═════════════════════════════════════════ */}
      <SysCard title="Maux de tête" icon="🗡" accentColor="var(--accent)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
          {[
            'Frontaux et orbitaux', 'Occipitaux',
            'Temporaux', 'Sur toute la tête',
            'Au sommet de la tête', 'Améliorés par le froid',
            'Améliorés par la chaleur', '',
            'Améliorés par le repos', '',
            'Améliorés par l\'exercice', '',
            'Douleur légère – perçante – mobile', '',
            'Migraine', '',
          ].map((v, i) =>
            v ? <Chk key={i} label={v} checked={tete.checked.includes(v)} onChange={() => chk('tete', v)} />
              : <div key={i} />
          )}
        </div>
        <NoteBox value={tete.note} onChange={v => set('tete', { note: v })} />
      </SysCard>

      {/* ══ TEMPÉRATURE ══════════════════════════════════════════ */}
      <SysCard title="Température" icon="🌡" accentColor="var(--teal-mid)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
          {[
            'Mains froides',           'Paumes chaudes',
            'Pieds froids',            'Plantes des pieds chaudes',
            'Corps froid',             'Sensation générale de chaleur',
            'Nez froid',               'Chaud la nuit',
            'Préférence pour l\'été',  'Préférence pour l\'hiver',
            'Préférence pour les aliments chauds', 'Préférence pour les salades',
          ].map((v, i) =>
            <Chk key={i} label={v} checked={temp.checked.includes(v)} onChange={() => chk('temp', v)} />
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <Chk
            label="Alternance entre sensation de froid et de chaud, n'aime pas les changements extrêmes de température"
            checked={temp.checked.includes("Alternance froid/chaud")}
            onChange={() => chk('temp', "Alternance froid/chaud")}
          />
        </div>
        <NoteBox value={temp.note} onChange={v => set('temp', { note: v })} />
      </SysCard>

      {/* ══ MUSCULO-SQUELETTIQUE (pleine largeur) ════════════════ */}
      <SysCard title="Musculo-squelettique" icon="🦴" accentColor="var(--rose)" colSpan>
        <ScoreRow label="Niveau de douleur" value={musculo.douleur} onChange={v => set('musculo', { douleur: v })} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', marginBottom: 8 }}>
          {[
            'Douleur constante',       'apparaît et disparaît',
            'Raideur',                 'gonflement',
            'Douleur localisée',       'douleur itinérante',
            'Amplitude de mouvement réduite', '',
            'Amélioration avec la chaleur',   '',
            'Amélioration avec le froid',     '',
            'Amélioration avec le repos',     '',
            'Amélioration avec l\'exercice',  '',
            'Amélioration avec le massage',   '',
          ].map((v, i) =>
            v ? <Chk key={i} label={v} checked={musculo.checked.includes(v)} onChange={() => chk('musculo', v)} />
              : <div key={i} />
          )}
        </div>

        <div className="field">
          <label style={{ fontSize: 12 }}>Emplacement de la douleur</label>
          <input
            type="text"
            value={musculo.localisation}
            onChange={e => set('musculo', { localisation: e.target.value })}
            placeholder="Ex : lombaires gauches, épaule droite, genou, nuque…"
          />
        </div>
        <NoteBox value={musculo.note} onChange={v => set('musculo', { note: v })} placeholder="Notes sur la douleur, évolution, facteurs aggravants…" />
      </SysCard>

    </div>
  )
}
