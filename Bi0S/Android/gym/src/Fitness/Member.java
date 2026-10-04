package Fitness;

class Member extends Person {
    private double weight;
    private double height;
    private double fee;

    public Member(String name, int age, double weight, double height) {
        super(name, age);
        this.weight = weight;
        this.height = height;
        calculateFee();
    }

    public double getWeight() { return weight; }
    public double getHeight() { return height; }

    public void calculateFee() {
        fee = 1000;  // Basic fee
    }

    @Override
    void displayDetails() {
        System.out.println("Member: " + name + ", Fee: " + fee);
    }
}