"use client"

import { createPatient } from "@/lib/patients/actions"
import type { AssignableStaff } from "@/lib/staff/queries"
import { PatientForm } from "./patient-form"

function NewPatientForm({ staffOptions }: { staffOptions: AssignableStaff[] }) {
  return <PatientForm mode="create" staffOptions={staffOptions} onSubmit={createPatient} />
}

export { NewPatientForm }
