package Fitness;
class Trainer extends Person {
    private String specialization;

    public Trainer(String name, int age, String specialization) {
        super(name, age);
        this.specialization = specialization;
    }

    @Override
    void displayDetails() {
        System.out.println("Trainer: " + name + " - " + specialization);
    }
}