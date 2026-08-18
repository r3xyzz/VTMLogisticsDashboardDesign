// src/types/database.ts
export interface Client {
    id: string;
    code: string;
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    tax_id: string | null;
    payment_terms: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Order {
    id: string;
    order_number: string;
    client_id: string;
    client_contact: string | null;
    service_type: string;
    service_date: string;
    quantity: number | null;
    package_type: string | null;
    weight_kg: number | null;
    volume_cbm: number | null;
    container_number: string | null;
    description: string | null;
    origin: string;
    destination: string;
    is_inside_triangle: boolean;
    sold_value: number;
    purchased_value: number;
    profit: number;
    status: string;
    priority: string;
    created_at: string;
    updated_at: string;
    // Relaciones (opcional)
    client?: Client;
}

export interface Fleet {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
    year: number | null;
    vehicle_type: string;
    capacity_kg: number | null;
    capacity_cbm: number | null;
    status: string;
    driver_name: string | null;
    driver_phone: string | null;
    driver_license: string | null;
    current_location: string | null;
    last_maintenance: string | null;
    next_maintenance: string | null;
    created_at: string;
    updated_at: string;
}

export interface Driver {
    id: string;
    rut: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    license_number: string;
    license_type: string | null;
    license_expiry: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface TripAssignment {
    id: string;
    order_id: string;
    fleet_id: string | null;
    driver_id: string | null;
    provider_id: string | null;
    status: string;
    assigned_at: string;
    pickup_time: string | null;
    estimated_arrival: string | null;
    actual_arrival: string | null;
    return_time: string | null;
    current_location: string | null;
    last_gps_update: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    // Relaciones
    order?: Order;
    fleet?: Fleet;
    driver?: Driver;
}

export interface Tracking {
    id: string;
    trip_assignment_id: string;
    status: string;
    latitude: number | null;
    longitude: number | null;
    location: string | null;
    speed: number | null;
    heading: number | null;
    event_description: string | null;
    event_type: string | null;
    recorded_at: string;
}

export interface AdditionalCost {
    id: string;
    order_id: string;
    cost_type: string;
    description: string | null;
    amount: number;
    currency: string;
    is_charged_to_client: boolean;
    is_approved: boolean;
    approved_at: string | null;
    created_at: string;
}