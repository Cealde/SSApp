package Fitness;
class PremiumMember extends Member {

    public PremiumMember(String name, int age, double weight, double height) {
        super(name, age, weight, height);
    }

    @Override
    public void calculateFee() {
        super.calculateFee();
        System.out.println("Premium Member Fee: 2000");
    }
}
