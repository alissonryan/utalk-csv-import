import { NextResponse } from 'next/server'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string(),
  phone: z.string()
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validated = contactSchema.parse(body)
    
    const response = await fetch(`${process.env.API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UTALK_API_TOKEN}`
      },
      body: JSON.stringify(validated)
    })

    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
} 