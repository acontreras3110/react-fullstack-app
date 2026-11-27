// Formulario generado desde los comodines de la plantilla guardada.
//
// 🔑 React Hook Form = inputs NO CONTROLADOS.
//   ❌ useState por campo (value + onChange): con 40 campos, cada tecla re-renderiza el
//      formulario entero.
//   ✅ register(name): RHF guarda una ref al <input> y lee su valor del DOM cuando hace
//      falta (validar, enviar). Escribir NO re-renderiza el formulario.
//   (Es la misma idea que el editor de Diseño: el DOM guarda el estado, React lo consulta.)
//
// Validación: esquema Zod generado en runtime + zodResolver.
//   mode 'onTouched': valida un campo al salir de él y, desde entonces, en cada tecla.
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { buildDefaults, buildSchema, type FormField, type FormValues } from './formModel'
import { ListField } from './ListField'

type DynamicFormProps = {
  fields: FormField[]
  onSubmit: (values: FormValues) => void
}

export function DynamicForm({ fields, onSubmit }: DynamicFormProps) {
  // useForm lee defaultValues y resolver SOLO al montar. Si la plantilla cambia, el padre
  // pasa otra `key` y este componente se monta de nuevo (mismo truco que el paso 4).
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitted, isValid },
  } = useForm<FormValues>({
    defaultValues: buildDefaults(fields),
    // El esquema es dinámico (su tipo TS no se conoce al compilar): se tipa a mano.
    resolver: zodResolver(buildSchema(fields)) as Resolver<FormValues>,
    mode: 'onTouched',
  })

  const errorCount = Object.keys(errors).length

  if (fields.length === 0) return <p className="muted">La plantilla no tiene comodines: no hay nada que rellenar.</p>

  return (
    // handleSubmit(fn): previene el submit del navegador, valida con Zod y SOLO llama a fn
    // si todo es válido (con los datos ya parseados: strings recortados por .trim()).
    <form className="dynamic-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="form-grid">
        {fields
          .filter((f) => f.kind === 'value')
          .map((f) => {
            const error = (errors[f.key] as { message?: string } | undefined)?.message
            return (
              <label key={f.key} className="form-field">
                <span>
                  {f.label} {f.required && <span className="req">*</span>}
                </span>
                <input {...register(f.key)} aria-invalid={!!error} placeholder={`{{${f.key}}}`} />
                {error && <small className="error">{error}</small>}
              </label>
            )
          })}
      </div>

      {fields.map((f) =>
        f.kind === 'list' ? (
          <ListField key={f.key} field={f} control={control} register={register} errors={errors} />
        ) : null,
      )}

      <div className="form-actions">
        <button type="submit" className="primary">
          Validar y ver datos
        </button>
        <button type="button" onClick={() => reset()}>
          Limpiar
        </button>
        {isSubmitted && !isValid && errorCount > 0 && (
          <span className="error">⚠️ {errorCount} campo(s) con errores</span>
        )}
      </div>
    </form>
  )
}
