import { describe, it, expect } from "vitest";
import {
  DEFAULT_APPOINTMENT_TYPES,
  DEFAULT_ROOMS,
  DEFAULT_SERVICES,
  practiceDefaults,
} from "../defaults";

const ROOM_TYPES = ["exam", "surgery", "treatment", "boarding"];

describe("default appointment types", () => {
  it("are non-empty and well-formed", () => {
    expect(DEFAULT_APPOINTMENT_TYPES.length).toBeGreaterThan(0);
    for (const t of DEFAULT_APPOINTMENT_TYPES) {
      expect(t.name.trim()).not.toBe("");
      expect(t.durationMinutes).toBeGreaterThan(0);
      expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect([0, 1]).toContain(t.requiresDoctor);
      expect(ROOM_TYPES).toContain(t.defaultRoomType);
    }
  });
});

describe("localized practice defaults", () => {
  it("creates Spanish display names while preserving appointment semantics", () => {
    const english = practiceDefaults("en");
    const spanish = practiceDefaults("es");

    expect(spanish.locationName).toBe("Ubicación principal");
    expect(spanish.rooms.map((room) => room.name)).toEqual([
      "Consultorio 1",
      "Consultorio 2",
      "Quirófano",
      "Área de tratamiento",
    ]);
    expect(spanish.appointmentTypes.map((type) => type.name)).toEqual([
      "Consulta de bienestar",
      "Consulta por enfermedad",
      "Vacunación",
      "Cirugía",
      "Limpieza dental",
      "Control / seguimiento",
    ]);
    expect(spanish.services.map((service) => service.name)).toContain(
      "Vacuna antirrábica",
    );
    expect(spanish.appointmentTypes.map(({ name: _name, ...type }) => type)).toEqual(
      english.appointmentTypes.map(({ name: _name, ...type }) => type),
    );
    expect(spanish.rooms.map(({ name: _name, ...room }) => room)).toEqual(
      english.rooms.map(({ name: _name, ...room }) => room),
    );
    expect(spanish.services.map(({ name: _name, ...service }) => service)).toEqual(
      english.services.map(({ name: _name, ...service }) => service),
    );
  });

  it("keeps the existing English names as the explicit English catalog", () => {
    const english = practiceDefaults("en");
    expect(english.locationName).toBe("Main Location");
    expect(english.rooms[0]?.name).toBe("Exam Room 1");
    expect(english.appointmentTypes.map((type) => type.name)).toEqual([
      "Wellness Exam",
      "Sick Visit",
      "Vaccination",
      "Surgery",
      "Dental Cleaning",
      "Recheck / Follow-up",
    ]);
  });
});

describe("default rooms", () => {
  it("have valid types and unique names", () => {
    expect(DEFAULT_ROOMS.length).toBeGreaterThan(0);
    const names = DEFAULT_ROOMS.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    for (const r of DEFAULT_ROOMS) expect(ROOM_TYPES).toContain(r.type);
  });
});

describe("default services", () => {
  it("have parseable, non-negative prices and names", () => {
    expect(DEFAULT_SERVICES.length).toBeGreaterThan(0);
    for (const s of DEFAULT_SERVICES) {
      expect(s.name.trim()).not.toBe("");
      const price = Number(s.defaultPrice);
      expect(Number.isFinite(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(0);
      expect(s.defaultPrice).toMatch(/^\d+\.\d{2}$/);
      expect(typeof s.taxable).toBe("boolean");
    }
  });
});
